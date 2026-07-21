import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { GenerationService } from "../src/generation.js";
import { resetTestDatabase, testDatabaseUrl } from "./test-database.js";

describe("ImagineLab API", () => {
  let app: FastifyInstance;
  let config: AppConfig;
  let childToken: string;
  let childUserId: string;

  beforeEach(async () => {
    config = {
      nodeEnv: "test",
      host: "127.0.0.1",
      port: 8080,
      publicBaseUrl: "http://localhost:8080",
      databaseUrl: testDatabaseUrl,
      autoMigrate: true,
      openAiModel: "gpt-5.6",
      openAiImageModel: "gpt-image-2",
      openAiTranscriptionModel: "gpt-4o-mini-transcribe",
      allowedOrigins: ["http://localhost:3000"],
    };
    app = await buildApp({ config });
    await resetTestDatabase();
    const guest = await createGuest(app);
    childToken = guest.token;
    childUserId = guest.user.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it("allows browser preflight requests for builder updates and deletes", async () => {
    const putPreflight = await app.inject({
      method: "OPTIONS",
      url: "/api/projects/example/builder",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "PUT",
        "access-control-request-headers": "authorization,content-type",
      },
    });

    expect(putPreflight.statusCode).toBe(204);
    expect(putPreflight.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(putPreflight.headers["access-control-allow-methods"]).toContain("PUT");
    expect(putPreflight.headers["access-control-allow-methods"]).toContain("DELETE");
  });

  it("creates, edits, and publishes a playable project", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders(childToken),
      payload: { prompt: "A frog catches glowing stars" },
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created.project.currentVersion.versionNumber).toBe(1);
    expect(created.project.currentVersion.html).toContain("Content-Security-Policy");
    expect(created.project.builder.creativePlan.gameDirections).toHaveLength(3);
    expect(created.project.builder.creativePlan.elementMissions).toHaveLength(3);
    expect(created.project.builder.assets).toEqual([]);

    const editResponse = await app.inject({
      method: "POST",
      url: `/api/projects/${created.project.id}/edits`,
      headers: childHeaders(childToken),
      payload: { instruction: "Make it faster and give me three lives" },
    });
    expect(editResponse.statusCode).toBe(201);
    expect(editResponse.json().project.currentVersion.versionNumber).toBe(2);

    const publishResponse = await app.inject({
      method: "POST",
      url: `/api/projects/${created.project.id}/publish`,
      headers: { authorization: `Bearer ${childToken}` },
    });
    expect(publishResponse.statusCode).toBe(200);
    const published = publishResponse.json();
    expect(published.publicUrl).toMatch(/\/g\/[a-z0-9-]+$/);
    expect(published.project.currentVersion.versionNumber).toBe(2);
    expect(published.project.currentVersion.id).toBe(published.project.currentVersionId);

    const publicResponse = await app.inject({
      method: "GET",
      url: new URL(published.publicUrl).pathname,
    });
    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.headers["content-security-policy"]).toContain(
      "script-src 'unsafe-inline'",
    );
    expect(publicResponse.body).toContain('sandbox="allow-scripts"');
    expect(publicResponse.body).toContain("Made with ImagineLab");
  });

  it("creates every project with a stable profile-image URL", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders(childToken),
      payload: { prompt: "A fox follows fireflies through a crystal forest" },
    });

    expect(response.statusCode).toBe(201);
    const project = response.json().project;
    expect(project.profileImageUrl).toBe(`/api/projects/${project.id}/profile-image`);
  });

  it("serves the stored project profile image to its child owner", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders(childToken),
      payload: { prompt: "A whale carries a tiny garden across the clouds" },
    });
    const projectId = created.json().project.id as string;

    const response = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/profile-image`,
      headers: childHeaders(childToken),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("image/svg+xml");
    expect(response.headers["cache-control"]).toContain("private");
    expect(response.rawPayload.toString("utf8")).toContain("<svg");
  });

  it("allows only the owner or a linked guardian to read a project profile image", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders(childToken),
      payload: { prompt: "A moon rabbit sorts colorful comets" },
    });
    const projectId = created.json().project.id as string;
    const linkedGuardian = await registerGuardian(app, "image-linked@example.com");
    const unlinkedGuardian = await registerGuardian(app, "image-unlinked@example.com");

    const denied = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/profile-image`,
      headers: { cookie: unlinkedGuardian.cookie },
    });
    expect(denied.statusCode).toBe(403);

    await app.inject({
      method: "POST",
      url: "/api/guardian/children/link",
      headers: { cookie: linkedGuardian.cookie, "content-type": "application/json" },
      payload: { childId: (await getMe(app, childToken)).childId },
    });
    const allowed = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/profile-image`,
      headers: { cookie: linkedGuardian.cookie },
    });
    expect(allowed.statusCode).toBe(200);
  });

  it("accepts a child push-to-talk recording and returns its transcript", async () => {
    await app.close();
    const generation = new StubTranscriptionService(config);
    app = await buildApp({ config, generation });
    const { boundary, payload } = audioUpload();

    const response = await app.inject({
      method: "POST",
      url: "/api/transcriptions",
      headers: {
        authorization: `Bearer ${childToken}`,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ text: "Make a moon garden game with three friendly robots." });
    expect(generation.lastInput).toMatchObject({ fileName: "idea.m4a", mediaType: "audio/mp4" });
  });

  it("normalizes mobile M4A MIME aliases before transcription", async () => {
    await app.close();
    const generation = new StubTranscriptionService(config);
    app = await buildApp({ config, generation });

    for (const mediaType of ["audio/x-m4a", "audio/aac", "application/octet-stream"]) {
      const { boundary, payload } = audioUpload({ mediaType });
      const response = await app.inject({
        method: "POST",
        url: "/api/transcriptions",
        headers: {
          authorization: `Bearer ${childToken}`,
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });
      expect(response.statusCode).toBe(200);
      expect(generation.lastInput).toMatchObject({ fileName: "idea.m4a", mediaType: "audio/mp4" });
    }
  });

  it("prevents a guardian from uploading a child's voice recording", async () => {
    const guardian = await registerGuardian(app, "voice-parent@example.com");
    const { boundary, payload } = audioUpload();
    const response = await app.inject({
      method: "POST",
      url: "/api/transcriptions",
      headers: {
        cookie: guardian.cookie,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(403);
  });

  it("allows only a linked guardian to generate a project insight", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders(childToken),
      payload: { prompt: "A soccer game with a friendly robot goalie" },
    });
    const projectId = createResponse.json().project.id as string;

    const linkedGuardian = await registerGuardian(app, "linked@example.com");
    const unlinkedGuardian = await registerGuardian(app, "unlinked@example.com");
    await app.inject({
      method: "POST",
      url: "/api/guardian/children/link",
      headers: { cookie: linkedGuardian.cookie, "content-type": "application/json" },
      payload: { childId: (await getMe(app, childToken)).childId },
    });

    const denied = await app.inject({
      method: "POST",
      url: `/api/guardian/children/${childUserId}/projects/${projectId}/insight`,
      headers: { cookie: unlinkedGuardian.cookie },
    });
    expect(denied.statusCode).toBe(403);

    const allowed = await app.inject({
      method: "POST",
      url: `/api/guardian/children/${childUserId}/projects/${projectId}/insight`,
      headers: { cookie: linkedGuardian.cookie },
    });
    expect(allowed.statusCode).toBe(201);
    expect(allowed.json().insight.dimensions.length).toBeGreaterThanOrEqual(2);
    expect(allowed.json().insight.disclaimer).toContain("not a psychological");
  });

  it("returns immutable project version history to a linked guardian", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders(childToken),
      payload: { prompt: "A penguin explores a crystal cave" },
    });
    const projectId = createResponse.json().project.id as string;
    await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/edits`,
      headers: childHeaders(childToken),
      payload: { instruction: "Add glowing keys and a friendly dragon" },
    });

    const guardian = await registerGuardian(app, "versions@example.com");
    await app.inject({
      method: "POST",
      url: "/api/guardian/children/link",
      headers: { cookie: guardian.cookie, "content-type": "application/json" },
      payload: { childId: (await getMe(app, childToken)).childId },
    });
    const dashboard = await app.inject({
      method: "GET",
      url: `/api/guardian/children/${childUserId}/projects`,
      headers: { cookie: guardian.cookie },
    });

    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json().projects[0].versions.map((version: { versionNumber: number }) => version.versionNumber)).toEqual([1, 2]);
  });

  it("generates one child-level insight from every project in the linked child's portfolio", async () => {
    const firstProject = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders(childToken),
      payload: { prompt: "A bird learns what makes different forest animals happy" },
    });
    const secondProject = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders(childToken),
      payload: { prompt: "A moon rover collects musical crystals" },
    });
    const projectIds = [
      firstProject.json().project.id as string,
      secondProject.json().project.id as string,
    ].sort();

    const guardian = await registerGuardian(app, "portfolio-insight@example.com");
    const unlinkedGuardian = await registerGuardian(app, "unlinked-portfolio@example.com");
    await app.inject({
      method: "POST",
      url: "/api/guardian/children/link",
      headers: { cookie: guardian.cookie, "content-type": "application/json" },
      payload: { childId: (await getMe(app, childToken)).childId },
    });

    const denied = await app.inject({
      method: "POST",
      url: `/api/guardian/children/${childUserId}/insight`,
      headers: { cookie: unlinkedGuardian.cookie },
    });
    expect(denied.statusCode).toBe(403);

    const generated = await app.inject({
      method: "POST",
      url: `/api/guardian/children/${childUserId}/insight`,
      headers: { cookie: guardian.cookie },
    });

    expect(generated.statusCode).toBe(201);
    expect(generated.json().insight.scope).toBe("portfolio");
    expect([...generated.json().insight.sourceProjectIds].sort()).toEqual(projectIds);
    expect(generated.json().insight.radar.dimensions).toHaveLength(6);

    const restored = await app.inject({
      method: "GET",
      url: `/api/guardian/children/${childUserId}/insight`,
      headers: { cookie: guardian.cookie },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().insight.id).toBe(generated.json().insight.id);
  });

  it("waits for project evidence before generating a child-level insight", async () => {
    const guardian = await registerGuardian(app, "empty-portfolio@example.com");
    await app.inject({
      method: "POST",
      url: "/api/guardian/children/link",
      headers: { cookie: guardian.cookie, "content-type": "application/json" },
      payload: { childId: (await getMe(app, childToken)).childId },
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/guardian/children/${childUserId}/insight`,
      headers: { cookie: guardian.cookie },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toContain("at least one project");
  });

  it("keeps the last published version live until a newer draft is published", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders(childToken),
      payload: { prompt: "A calm moon garden game" },
    });
    const projectId = createResponse.json().project.id as string;
    const publishResponse = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/publish`,
      headers: { authorization: `Bearer ${childToken}` },
    });
    const publicPath = new URL(publishResponse.json().publicUrl).pathname;

    const editResponse = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/edits`,
      headers: childHeaders(childToken),
      payload: { instruction: "Make it faster with three lives" },
    });
    expect(editResponse.json().project.status).toBe("published");

    const stillPublished = await app.inject({ method: "GET", url: publicPath });
    expect(stillPublished.body).toContain("A calm moon garden game");
    expect(stillPublished.body).not.toContain("Make it faster with three lives");

    await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/publish`,
      headers: { authorization: `Bearer ${childToken}` },
    });
    const updatedPublicGame = await app.inject({ method: "GET", url: publicPath });
    expect(updatedPublicGame.body).toContain("Make it faster with three lives");

    await app.inject({
      method: "DELETE",
      url: `/api/projects/${projectId}/publish`,
      headers: { authorization: `Bearer ${childToken}` },
    });
    const unavailable = await app.inject({ method: "GET", url: publicPath });
    expect(unavailable.statusCode).toBe(404);
  });

  it("prevents one child from accessing another child's project", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders(childToken),
      payload: { prompt: "A tiny garden game" },
    });
    const projectId = createResponse.json().project.id as string;

    const otherChild = await createGuest(app);
    const response = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}`,
      headers: { authorization: `Bearer ${otherChild.token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it("saves a child canvas draft, offers design ideas, and requires a selection before testing", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders(childToken),
      payload: { prompt: "A bird flies through a friendly forest" },
    });
    const projectId = created.json().project.id as string;
    const draft = {
      stage: "build",
      creativePlan: created.json().project.builder.creativePlan,
      interpretationStatus: "pending",
      interpretation: null,
      assets: [
        {
          id: "2e312623-493f-4632-8d84-a03ec57e352a",
          kind: "background",
          name: "My forest",
          imageDataUrl: "data:image/png;base64,abc",
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          zIndex: 0,
        },
        {
          id: "47d4c71c-13c2-40d5-aeca-85bdf7862662",
          kind: "object",
          missionId: created.json().project.builder.creativePlan.elementMissions[0].id,
          name: "My forest bird",
          imageDataUrl: "data:image/png;base64,def",
          x: 0.35,
          y: 0.35,
          width: 0.28,
          height: 0.28,
          zIndex: 1,
        },
      ],
      variants: [],
      selectedVariantId: null,
      updatedAt: new Date().toISOString(),
    };
    const backgroundOnly = await app.inject({
      method: "PUT",
      url: `/api/projects/${projectId}/builder`,
      headers: childHeaders(childToken),
      payload: { draft: { ...draft, assets: draft.assets.slice(0, 1) } },
    });
    expect(backgroundOnly.statusCode).toBe(200);
    const tooEarly = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/builder/variants`,
      headers: { authorization: `Bearer ${childToken}` },
    });
    expect(tooEarly.statusCode).toBe(422);

    const saved = await app.inject({
      method: "PUT",
      url: `/api/projects/${projectId}/builder`,
      headers: childHeaders(childToken),
      payload: { draft },
    });
    expect(saved.statusCode).toBe(200);

    const variants = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/builder/variants`,
      headers: { authorization: `Bearer ${childToken}` },
    });
    expect(variants.statusCode).toBe(200);
    expect(variants.json().draft.variants).toHaveLength(4);

    const withoutSelection = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/builder/test`,
      headers: { authorization: `Bearer ${childToken}` },
    });
    expect(withoutSelection.statusCode).toBe(422);

    const draftWithSelection = {
      ...variants.json().draft,
      interpretation: "The bird follows the player's finger and collects glowing seeds.",
      selectedVariantId: variants.json().draft.variants[0].id,
    };
    const selected = await app.inject({
      method: "PUT",
      url: `/api/projects/${projectId}/builder`,
      headers: childHeaders(childToken),
      payload: { draft: draftWithSelection },
    });
    expect(selected.statusCode).toBe(200);

    const testBuild = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/builder/test`,
      headers: { authorization: `Bearer ${childToken}` },
    });
    expect(testBuild.statusCode).toBe(201);
    expect(testBuild.json().project.currentVersion.versionNumber).toBe(2);

    const readyDraft = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/builder`,
      headers: { authorization: `Bearer ${childToken}` },
    });
    expect(readyDraft.json().draft.stage).toBe("ready_to_publish");
    expect(readyDraft.json().draft.interpretation).toContain("follows the player's finger");
  });

  it("deletes only the owner's project and removes its public game", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders(childToken),
      payload: { prompt: "A little moon garden" },
    });
    const projectId = created.json().project.id as string;
    const published = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/publish`,
      headers: { authorization: `Bearer ${childToken}` },
    });
    const publicPath = new URL(published.json().publicUrl).pathname;

    const denied = await app.inject({
      method: "DELETE",
      url: `/api/projects/${projectId}`,
      headers: { authorization: `Bearer ${(await createGuest(app)).token}` },
    });
    expect(denied.statusCode).toBe(403);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/projects/${projectId}`,
      headers: { authorization: `Bearer ${childToken}` },
    });
    expect(deleted.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: `/api/projects/${projectId}`, headers: childHeaders(childToken) })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: publicPath })).statusCode).toBe(404);
  });
});

function childHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

async function createGuest(app: FastifyInstance): Promise<{
  token: string;
  user: { id: string; childId: string };
}> {
  const response = await app.inject({ method: "POST", url: "/api/auth/child/guest" });
  expect(response.statusCode).toBe(201);
  return response.json();
}

async function getMe(
  app: FastifyInstance,
  token: string,
): Promise<{ id: string; childId: string }> {
  const response = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${token}` },
  });
  return response.json().user;
}

async function registerGuardian(
  app: FastifyInstance,
  email: string,
): Promise<{ cookie: string }> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/guardian/register",
    headers: { "content-type": "application/json" },
    payload: { displayName: "Parent", email, password: "build-together-123" },
  });
  expect(response.statusCode).toBe(201);
  const setCookie = response.headers["set-cookie"];
  const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(";")[0] ?? "";
  return { cookie };
}

class StubTranscriptionService extends GenerationService {
  public lastInput: { audio: Buffer; fileName: string; mediaType: string } | null = null;

  public override async transcribeAudio(input: {
    audio: Buffer;
    fileName: string;
    mediaType: string;
  }): Promise<string> {
    this.lastInput = input;
    return "Make a moon garden game with three friendly robots.";
  }
}

function audioUpload(options: { fileName?: string; mediaType?: string } = {}): { boundary: string; payload: Buffer } {
  const boundary = "imaginelab-audio-boundary";
  const fileName = options.fileName ?? "idea.m4a";
  const mediaType = options.mediaType ?? "audio/mp4";
  const payload = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${mediaType}\r\n\r\n` +
      "pretend audio bytes\r\n" +
      `--${boundary}--\r\n`,
  );
  return { boundary, payload };
}
