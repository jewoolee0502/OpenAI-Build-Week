import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { AuthService } from "./auth.js";
import type { AppConfig } from "./config.js";
import {
  type AuthenticatedUser,
  type ProjectWithCurrentVersion,
  createProjectBodySchema,
  editProjectBodySchema,
} from "./domain.js";
import { GenerationService } from "./generation.js";
import { renderPublicGamePage, UnsafeGameBundleError } from "./safety.js";
import { LocalProjectStore } from "./store.js";

const projectParamsSchema = z.object({ projectId: z.string().uuid() });
const childParamsSchema = z.object({ childUserId: z.string().min(1).max(128) });
const guardianProjectParamsSchema = childParamsSchema.extend({ projectId: z.string().uuid() });
const slugParamsSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]{4,80}$/) });
const supportedAudioTypes = new Set([
  "audio/mp4",
  "audio/m4a",
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
]);

const publicGamePageCsp = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function requireRole(user: AuthenticatedUser, role: "child" | "guardian"): void {
  if (user.role !== role) {
    const error = new Error(`This endpoint requires a ${role} account`);
    Object.assign(error, { statusCode: 403 });
    throw error;
  }
}

function requireProjectOwner(user: AuthenticatedUser, project: ProjectWithCurrentVersion): void {
  requireRole(user, "child");
  if (project.childUserId !== user.id) {
    const error = new Error("You do not have access to this project");
    Object.assign(error, { statusCode: 403 });
    throw error;
  }
}

function notFound(message: string): Error {
  const error = new Error(message);
  Object.assign(error, { statusCode: 404 });
  return error;
}

export interface AppDependencies {
  config: AppConfig;
  store?: LocalProjectStore;
  generation?: GenerationService;
}

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const { config } = dependencies;
  const app = Fastify({ logger: config.nodeEnv !== "test" });
  const store = dependencies.store ?? new LocalProjectStore(config.dataFile);
  const generation = dependencies.generation ?? new GenerationService(config);
  const auth = new AuthService(config);

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Origin not allowed"), false);
    },
    allowedHeaders: ["Authorization", "Content-Type", "X-Demo-User-Id", "X-Demo-Role"],
  });
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 25 * 1024 * 1024,
      fields: 0,
    },
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "Invalid request",
        details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      });
    }
    if (error instanceof UnsafeGameBundleError) {
      return reply.status(error.statusCode).send({ error: error.message, details: error.reasons });
    }
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    const message = error instanceof Error ? error.message : "Unknown error";
    if (statusCode >= 500) app.log.error(error);
    return reply.status(statusCode).send({
      error: statusCode >= 500 ? "Something went wrong while building the game" : message,
    });
  });

  async function user(request: FastifyRequest): Promise<AuthenticatedUser> {
    return auth.authenticate(request);
  }

  async function linkedGuardian(
    request: FastifyRequest,
    childUserId: string,
  ): Promise<AuthenticatedUser> {
    const actor = await user(request);
    requireRole(actor, "guardian");
    if (!(await store.isGuardianLinked(actor.id, childUserId))) {
      const error = new Error("You are not linked to this child account");
      Object.assign(error, { statusCode: 403 });
      throw error;
    }
    return actor;
  }

  app.get("/health", async () => ({
    ok: true,
    service: "imaginelab-api",
    aiProvider: config.openAiApiKey ? "openai" : "demo",
  }));

  app.get("/api/projects", async (request) => {
    const actor = await user(request);
    requireRole(actor, "child");
    return { projects: await store.listProjectsForChild(actor.id) };
  });

  app.post("/api/transcriptions", async (request) => {
    const actor = await user(request);
    requireRole(actor, "child");
    const upload = await request.file();
    if (!upload || upload.fieldname !== "file") {
      const error = new Error("One audio file is required");
      Object.assign(error, { statusCode: 400 });
      throw error;
    }
    if (!supportedAudioTypes.has(upload.mimetype)) {
      const error = new Error("Unsupported audio format");
      Object.assign(error, { statusCode: 415 });
      throw error;
    }

    const audio = await upload.toBuffer();
    if (audio.length === 0) {
      const error = new Error("The audio recording is empty");
      Object.assign(error, { statusCode: 400 });
      throw error;
    }
    const text = await generation.transcribeAudio({
      audio,
      fileName: upload.filename || "voice-idea.m4a",
      mediaType: upload.mimetype,
    });
    return { text };
  });

  app.post("/api/projects", async (request, reply) => {
    const actor = await user(request);
    requireRole(actor, "child");
    const body = createProjectBodySchema.parse(request.body);
    const generated = await generation.createGame(body.prompt, actor.id);
    const project = await store.createProject({
      childUserId: actor.id,
      title: generated.title,
      prompt: body.prompt,
      html: generated.html,
    });
    return reply.status(201).send({ project, generation: { provider: generated.provider, summary: generated.childFacingSummary } });
  });

  app.get("/api/projects/:projectId", async (request) => {
    const actor = await user(request);
    const { projectId } = projectParamsSchema.parse(request.params);
    const project = await store.getProject(projectId);
    if (!project) throw notFound("Project not found");
    requireProjectOwner(actor, project);
    return {
      project,
      versions: await store.getVersions(project.id),
      activities: await store.getActivities(actor.id, project.id),
    };
  });

  app.post("/api/projects/:projectId/edits", async (request, reply) => {
    const actor = await user(request);
    const { projectId } = projectParamsSchema.parse(request.params);
    const body = editProjectBodySchema.parse(request.body);
    const current = await store.getProject(projectId);
    if (!current) throw notFound("Project not found");
    requireProjectOwner(actor, current);
    const generated = await generation.editGame({
      instruction: body.instruction,
      currentHtml: current.currentVersion.html,
      versionNumber: current.currentVersion.versionNumber + 1,
      userId: actor.id,
    });
    const project = await store.addVersion({
      projectId,
      prompt: body.instruction,
      html: generated.html,
    });
    if (!project) throw notFound("Project not found");
    return reply.status(201).send({ project, generation: { provider: generated.provider, summary: generated.childFacingSummary } });
  });

  app.post("/api/projects/:projectId/publish", async (request) => {
    const actor = await user(request);
    const { projectId } = projectParamsSchema.parse(request.params);
    const current = await store.getProject(projectId);
    if (!current) throw notFound("Project not found");
    requireProjectOwner(actor, current);
    const project = await store.setPublished(projectId, true);
    if (!project?.publicSlug) throw new Error("Could not publish project");
    return { project, publicUrl: `${config.publicBaseUrl}/g/${project.publicSlug}` };
  });

  app.delete("/api/projects/:projectId/publish", async (request, reply) => {
    const actor = await user(request);
    const { projectId } = projectParamsSchema.parse(request.params);
    const current = await store.getProject(projectId);
    if (!current) throw notFound("Project not found");
    requireProjectOwner(actor, current);
    await store.setPublished(projectId, false);
    return reply.status(204).send();
  });

  app.get("/api/guardian/children/:childUserId/projects", async (request) => {
    const { childUserId } = childParamsSchema.parse(request.params);
    await linkedGuardian(request, childUserId);
    return {
      projects: await store.listProjectsForChild(childUserId),
      activities: await store.getActivities(childUserId),
    };
  });

  app.get("/api/guardian/children/:childUserId/projects/:projectId/insight", async (request) => {
    const { childUserId, projectId } = guardianProjectParamsSchema.parse(request.params);
    await linkedGuardian(request, childUserId);
    const project = await store.getProject(projectId);
    if (!project || project.childUserId !== childUserId) throw notFound("Project not found");
    return { insight: await store.getLatestInsight(projectId) };
  });

  app.post(
    "/api/guardian/children/:childUserId/projects/:projectId/insight",
    async (request, reply) => {
      const { childUserId, projectId } = guardianProjectParamsSchema.parse(request.params);
      await linkedGuardian(request, childUserId);
      const project = await store.getProject(projectId);
      if (!project || project.childUserId !== childUserId) throw notFound("Project not found");
      const content = await generation.createInsight({
        childUserId,
        title: project.title,
        versions: await store.getVersions(projectId),
      });
      const insight = await store.saveInsight(project, content);
      return reply.status(201).send({ insight });
    },
  );

  app.get("/g/:slug", async (request, reply: FastifyReply) => {
    const { slug } = slugParamsSchema.parse(request.params);
    const project = await store.getPublishedProject(slug);
    if (!project) return reply.status(404).type("text/html").send("<!doctype html><title>Game unavailable</title><h1>This game is not published.</h1>");
    return reply
      .header("Content-Security-Policy", publicGamePageCsp)
      .header("Referrer-Policy", "no-referrer")
      .header("X-Content-Type-Options", "nosniff")
      .type("text/html; charset=utf-8")
      .send(renderPublicGamePage(project.title, project.currentVersion.html));
  });

  return app;
}
