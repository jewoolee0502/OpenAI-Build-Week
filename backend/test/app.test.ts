import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { GenerationService } from "../src/generation.js";

const childHeaders = {
  "x-demo-user-id": "demo-child",
  "x-demo-role": "child",
  "content-type": "application/json",
};

describe("ImagineLab API", () => {
  let app: FastifyInstance;
  let config: AppConfig;
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "imaginelab-test-"));
    config = {
      nodeEnv: "test",
      host: "127.0.0.1",
      port: 8080,
      publicBaseUrl: "http://localhost:8080",
      dataFile: join(temporaryDirectory, "database.json"),
      authMode: "dev",
      openAiModel: "gpt-5.6",
      openAiTranscriptionModel: "gpt-4o-mini-transcribe",
      allowedOrigins: ["http://localhost:3000"],
    };
    app = await buildApp({ config });
  });

  afterEach(async () => {
    await app.close();
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("creates, edits, and publishes a playable project", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders,
      payload: { prompt: "A frog catches glowing stars" },
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created.project.currentVersion.versionNumber).toBe(1);
    expect(created.project.currentVersion.html).toContain("Content-Security-Policy");

    const editResponse = await app.inject({
      method: "POST",
      url: `/api/projects/${created.project.id}/edits`,
      headers: childHeaders,
      payload: { instruction: "Make it faster and give me three lives" },
    });
    expect(editResponse.statusCode).toBe(201);
    expect(editResponse.json().project.currentVersion.versionNumber).toBe(2);

    const publishResponse = await app.inject({
      method: "POST",
      url: `/api/projects/${created.project.id}/publish`,
      headers: { "x-demo-user-id": "demo-child", "x-demo-role": "child" },
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

  it("accepts a child push-to-talk recording and returns its transcript", async () => {
    await app.close();
    app = await buildApp({ config, generation: new StubTranscriptionService(config) });
    const { boundary, payload } = audioUpload();

    const response = await app.inject({
      method: "POST",
      url: "/api/transcriptions",
      headers: {
        "x-demo-user-id": "demo-child",
        "x-demo-role": "child",
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ text: "Make a moon garden game with three friendly robots." });
  });

  it("prevents a guardian from uploading a child's voice recording", async () => {
    const { boundary, payload } = audioUpload();
    const response = await app.inject({
      method: "POST",
      url: "/api/transcriptions",
      headers: {
        "x-demo-user-id": "demo-guardian",
        "x-demo-role": "guardian",
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
      headers: childHeaders,
      payload: { prompt: "A soccer game with a friendly robot goalie" },
    });
    const projectId = createResponse.json().project.id as string;

    const denied = await app.inject({
      method: "POST",
      url: `/api/guardian/children/demo-child/projects/${projectId}/insight`,
      headers: { "x-demo-user-id": "unlinked-guardian", "x-demo-role": "guardian" },
    });
    expect(denied.statusCode).toBe(403);

    const allowed = await app.inject({
      method: "POST",
      url: `/api/guardian/children/demo-child/projects/${projectId}/insight`,
      headers: { "x-demo-user-id": "demo-guardian", "x-demo-role": "guardian" },
    });
    expect(allowed.statusCode).toBe(201);
    expect(allowed.json().insight.dimensions.length).toBeGreaterThanOrEqual(2);
    expect(allowed.json().insight.disclaimer).toContain("not a psychological");
  });

  it("keeps the last published version live until a newer draft is published", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders,
      payload: { prompt: "A calm moon garden game" },
    });
    const projectId = createResponse.json().project.id as string;
    const publishResponse = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/publish`,
      headers: { "x-demo-user-id": "demo-child", "x-demo-role": "child" },
    });
    const publicPath = new URL(publishResponse.json().publicUrl).pathname;

    const editResponse = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/edits`,
      headers: childHeaders,
      payload: { instruction: "Make it faster with three lives" },
    });
    expect(editResponse.json().project.status).toBe("published");

    const stillPublished = await app.inject({ method: "GET", url: publicPath });
    expect(stillPublished.body).toContain("A calm moon garden game");
    expect(stillPublished.body).not.toContain("Make it faster with three lives");

    await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/publish`,
      headers: { "x-demo-user-id": "demo-child", "x-demo-role": "child" },
    });
    const updatedPublicGame = await app.inject({ method: "GET", url: publicPath });
    expect(updatedPublicGame.body).toContain("Make it faster with three lives");

    await app.inject({
      method: "DELETE",
      url: `/api/projects/${projectId}/publish`,
      headers: { "x-demo-user-id": "demo-child", "x-demo-role": "child" },
    });
    const unavailable = await app.inject({ method: "GET", url: publicPath });
    expect(unavailable.statusCode).toBe(404);
  });

  it("prevents one child from accessing another child's project", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: childHeaders,
      payload: { prompt: "A tiny garden game" },
    });
    const projectId = createResponse.json().project.id as string;

    const response = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}`,
      headers: { "x-demo-user-id": "another-child", "x-demo-role": "child" },
    });
    expect(response.statusCode).toBe(403);
  });
});

class StubTranscriptionService extends GenerationService {
  public override async transcribeAudio(): Promise<string> {
    return "Make a moon garden game with three friendly robots.";
  }
}

function audioUpload(): { boundary: string; payload: Buffer } {
  const boundary = "imaginelab-audio-boundary";
  const payload = Buffer.from(
    `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="file"; filename="idea.m4a"\r\n' +
      "Content-Type: audio/mp4\r\n\r\n" +
      "pretend audio bytes\r\n" +
      `--${boundary}--\r\n`,
  );
  return { boundary, payload };
}
