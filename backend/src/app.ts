import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { AuthService, guardianSessionCookie } from "./auth.js";
import type { AppConfig } from "./config.js";
import { Database } from "./database.js";
import {
  type AuthenticatedUser,
  type ProjectWithCurrentVersion,
  createProjectBodySchema,
  editProjectBodySchema,
  guardianLoginBodySchema,
  guardianRegistrationBodySchema,
  linkChildBodySchema,
  saveBuilderBodySchema,
  type BuilderDraft,
} from "./domain.js";
import { GenerationService } from "./generation.js";
import { ProjectImageService } from "./project-image.js";
import { renderPublicGamePage, UnsafeGameBundleError } from "./safety.js";
import { type ApplicationStore, PostgresStore } from "./store.js";

const projectParamsSchema = z.object({ projectId: z.string().uuid() });
const childParamsSchema = z.object({ childUserId: z.string().uuid() });
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

function demoSceneVariants(project: ProjectWithCurrentVersion): BuilderDraft["variants"] {
  const palettes = [["#6D4FCA", "#E58A6E"], ["#24746A", "#8EE6CE"], ["#8D4D9B", "#FFB65E"], ["#305EAA", "#C96D83"]];
  return palettes.map(([start, end], index) => {
    const title = ["Moonlight adventure", "Forest friends", "Candy skyline", "Cosmic playground"][index] ?? "Game world";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient></defs><rect width="720" height="480" fill="url(#g)"/><circle cx="570" cy="100" r="68" fill="#fff" fill-opacity=".25"/><path d="M0 350 Q120 260 240 350 T480 350 T720 350 V480 H0Z" fill="#17142b" fill-opacity=".28"/><text x="36" y="64" fill="white" font-family="sans-serif" font-size="34" font-weight="700">${title}</text></svg>`;
    return { id: randomUUID(), title, description: `A playful visual direction for ${project.title}.`, previewDataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` };
  });
}

export interface AppDependencies {
  config: AppConfig;
  store?: ApplicationStore;
  database?: Database;
  generation?: GenerationService;
  projectImages?: ProjectImageService;
}

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const { config } = dependencies;
  const app = Fastify({ bodyLimit: 6 * 1024 * 1024, logger: config.nodeEnv !== "test" });
  const ownedDatabase = dependencies.store
    ? null
    : dependencies.database ?? new Database(config.databaseUrl);
  if (ownedDatabase && config.autoMigrate) await ownedDatabase.migrate();
  const store = dependencies.store ?? new PostgresStore(ownedDatabase!);
  const generation = dependencies.generation ?? new GenerationService(config);
  const projectImages = dependencies.projectImages ?? new ProjectImageService(config);
  const auth = new AuthService(config, store);

  if (ownedDatabase && !dependencies.database) {
    app.addHook("onClose", async () => ownedDatabase.close());
  }

  await app.register(cookie);
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Origin not allowed"), false);
    },
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  });
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 25 * 1024 * 1024,
      fields: 0,
    },
  });

  app.setErrorHandler((error, _request, reply) => {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return reply.status(413).send({ error: "This drawing is too large to save. Try a smaller or simpler drawing." });
    }
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
    storage: "postgresql",
    aiProvider: config.openAiApiKey ? "openai" : "demo",
  }));

  app.post("/api/auth/child/guest", async (_request, reply) => {
    const session = await auth.createGuest();
    return reply.status(201).send(session);
  });

  app.post("/api/auth/guardian/register", async (request, reply) => {
    const body = guardianRegistrationBodySchema.parse(request.body);
    const session = await auth.registerGuardian(body);
    reply.setCookie(guardianSessionCookie, session.token, auth.cookieOptions());
    return reply.status(201).send({ user: session.user });
  });

  app.post("/api/auth/guardian/login", async (request, reply) => {
    const body = guardianLoginBodySchema.parse(request.body);
    const session = await auth.loginGuardian(body);
    reply.setCookie(guardianSessionCookie, session.token, auth.cookieOptions());
    return { user: session.user };
  });

  app.post("/api/auth/guardian/logout", async (request, reply) => {
    await auth.revokeGuardianSession(request);
    reply.clearCookie(guardianSessionCookie, { path: "/" });
    return reply.status(204).send();
  });

  app.get("/api/auth/me", async (request) => ({ user: await user(request) }));

  app.get("/api/guardian/children", async (request) => {
    const actor = await user(request);
    requireRole(actor, "guardian");
    return { children: await store.listLinkedChildren(actor.id) };
  });

  app.post("/api/guardian/children/link", async (request, reply) => {
    const actor = await user(request);
    requireRole(actor, "guardian");
    const body = linkChildBodySchema.parse(request.body);
    const child = await store.linkChild(actor.id, body.childId);
    if (!child) throw notFound("No child account matches that Child ID");
    return reply.status(201).send({ child });
  });

  app.delete("/api/guardian/children/:childUserId/link", async (request, reply) => {
    const actor = await user(request);
    requireRole(actor, "guardian");
    const { childUserId } = childParamsSchema.parse(request.params);
    if (!(await store.unlinkChild(actor.id, childUserId))) {
      throw notFound("Active child link not found");
    }
    return reply.status(204).send();
  });

  app.get("/api/projects", async (request) => {
    const actor = await user(request);
    requireRole(actor, "child");
    return { projects: await store.listProjectsForChild(actor.id) };
  });

  app.delete("/api/projects/:projectId", async (request, reply) => {
    const actor = await user(request);
    const { projectId } = projectParamsSchema.parse(request.params);
    const project = await store.getProject(projectId);
    if (!project) throw notFound("Project not found");
    requireProjectOwner(actor, project);
    await store.deleteProject(projectId);
    return reply.status(204).send();
  });

  app.get("/api/projects/:projectId/builder", async (request) => {
    const actor = await user(request);
    const { projectId } = projectParamsSchema.parse(request.params);
    const project = await store.getProject(projectId);
    if (!project) throw notFound("Project not found");
    requireProjectOwner(actor, project);
    return { draft: project.builder ?? null };
  });

  app.put("/api/projects/:projectId/builder", async (request) => {
    const actor = await user(request);
    const { projectId } = projectParamsSchema.parse(request.params);
    const { draft } = saveBuilderBodySchema.parse(request.body);
    const project = await store.getProject(projectId);
    if (!project) throw notFound("Project not found");
    requireProjectOwner(actor, project);
    const updated = await store.saveBuilderDraft(projectId, draft);
    if (!updated?.builder) throw notFound("Project not found");
    return { draft: updated.builder };
  });

  app.post("/api/projects/:projectId/builder/variants", async (request) => {
    const actor = await user(request);
    const { projectId } = projectParamsSchema.parse(request.params);
    const project = await store.getProject(projectId);
    if (!project) throw notFound("Project not found");
    requireProjectOwner(actor, project);
    if (!project.builder?.assets.some((asset) => asset.kind === "background")) {
      const error = new Error("Save a background before asking ImagineLab for design ideas");
      Object.assign(error, { statusCode: 422 });
      throw error;
    }
    const draft: BuilderDraft = { ...project.builder, stage: "choose_design", variants: demoSceneVariants(project), selectedVariantId: null, updatedAt: new Date().toISOString() };
    const updated = await store.saveBuilderDraft(projectId, draft);
    return { draft: updated?.builder };
  });

  app.post("/api/projects/:projectId/builder/test", async (request, reply) => {
    const actor = await user(request);
    const { projectId } = projectParamsSchema.parse(request.params);
    const project = await store.getProject(projectId);
    if (!project) throw notFound("Project not found");
    requireProjectOwner(actor, project);
    const selected = project.builder?.variants.find((variant) => variant.id === project.builder?.selectedVariantId);
    if (!project.builder || !selected) {
      const error = new Error("Choose a design before testing your game");
      Object.assign(error, { statusCode: 422 });
      throw error;
    }
    const generated = await generation.createGame(`${project.currentVersion.prompt}. Use the selected visual direction: ${selected.title}.`, actor.id);
    const updatedProject = await store.addVersion({ projectId, prompt: `Test build: ${selected.title}`, html: generated.html });
    if (!updatedProject) throw notFound("Project not found");
    await store.saveBuilderDraft(projectId, { ...project.builder, stage: "ready_to_publish", updatedAt: new Date().toISOString() });
    return reply.status(201).send({ project: updatedProject, generation: { provider: generated.provider, summary: generated.childFacingSummary } });
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
    const [generated, profileImage] = await Promise.all([
      generation.createGame(body.prompt, actor.id),
      projectImages.generate({ childUserId: actor.id, projectPrompt: body.prompt }),
    ]);
    if (profileImage.fallbackReason) {
      app.log.warn(
        { reason: profileImage.fallbackReason },
        "Project profile image used the local fallback",
      );
    }
    const project = await store.createProject({
      childUserId: actor.id,
      title: generated.title,
      prompt: body.prompt,
      html: generated.html,
      profileImage,
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

  app.get("/api/projects/:projectId/profile-image", async (request, reply) => {
    const actor = await user(request);
    const { projectId } = projectParamsSchema.parse(request.params);
    const project = await store.getProject(projectId);
    if (!project) throw notFound("Project not found");

    const canView =
      (actor.role === "child" && actor.id === project.childUserId) ||
      (actor.role === "guardian" &&
        (await store.isGuardianLinked(actor.id, project.childUserId)));
    if (!canView) {
      const error = new Error("You do not have access to this project");
      Object.assign(error, { statusCode: 403 });
      throw error;
    }

    const image = await store.getProjectProfileImage(projectId);
    if (!image) throw notFound("Project profile image not found");
    return reply
      .header("Cache-Control", "private, max-age=3600")
      .header("Content-Disposition", "inline")
      .header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
      .header("ETag", `"${image.id}"`)
      .header("X-Content-Type-Options", "nosniff")
      .type(image.mimeType)
      .send(image.data);
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
      projects: await store.listProjectsWithVersionsForChild(childUserId),
      activities: await store.getActivities(childUserId),
    };
  });

  app.get("/api/guardian/children/:childUserId/insight", async (request) => {
    const { childUserId } = childParamsSchema.parse(request.params);
    await linkedGuardian(request, childUserId);
    return { insight: await store.getLatestChildInsight(childUserId) };
  });

  app.post("/api/guardian/children/:childUserId/insight", async (request, reply) => {
    const { childUserId } = childParamsSchema.parse(request.params);
    const guardian = await linkedGuardian(request, childUserId);
    const projects = await store.listProjectsWithVersionsForChild(childUserId);
    if (projects.length === 0) {
      const error = new Error("Create at least one project before generating child insights");
      Object.assign(error, { statusCode: 422 });
      throw error;
    }
    const content = await generation.createChildInsight({ childUserId, projects });
    const insight = await store.saveChildInsight({
      childUserId,
      requestedByGuardianUserId: guardian.id,
      sourceProjectIds: projects.map((project) => project.id),
      sourceVersionIds: projects.flatMap((project) =>
        project.versions.map((version) => version.id),
      ),
      content,
    });
    return reply.status(201).send({ insight });
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
      const guardian = await linkedGuardian(request, childUserId);
      const project = await store.getProject(projectId);
      if (!project || project.childUserId !== childUserId) throw notFound("Project not found");
      const versions = await store.getVersions(projectId);
      const content = await generation.createInsight({
        childUserId,
        title: project.title,
        versions,
      });
      const insight = await store.saveInsight({
        project,
        requestedByGuardianUserId: guardian.id,
        sourceVersionIds: versions.map((version) => version.id),
        content,
      });
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
