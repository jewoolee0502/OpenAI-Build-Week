import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { resetTestDatabase, testDatabaseUrl } from "./test-database.js";

describe("ImagineLab account flows", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const config: AppConfig = {
      nodeEnv: "test",
      host: "127.0.0.1",
      port: 8080,
      publicBaseUrl: "http://localhost:8080",
      databaseUrl: testDatabaseUrl,
      autoMigrate: true,
      openAiModel: "gpt-5.6",
      openAiImageModel: "gpt-image-2",
      openAiTranscriptionModel: "gpt-4o-mini-transcribe",
      allowedOrigins: ["http://localhost:5173"],
    };
    app = await buildApp({ config });
    await resetTestDatabase();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates a guest child and restores the account with its private bearer token", async () => {
    const guest = await createGuest(app);

    expect(guest.user.role).toBe("child");
    expect(guest.user.childId).toMatch(/^KID-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(guest.token.length).toBeGreaterThan(30);

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${guest.token}` },
    });

    expect(me.statusCode).toBe(200);
    expect(me.json().user).toEqual(guest.user);
  });

  it("registers a guardian and immediately links a guest child by Child ID", async () => {
    const guest = await createGuest(app);
    const guardian = await registerGuardian(app, "maya.parent@example.com");

    const linked = await app.inject({
      method: "POST",
      url: "/api/guardian/children/link",
      headers: { cookie: guardian.cookie, "content-type": "application/json" },
      payload: { childId: guest.user.childId },
    });

    expect(linked.statusCode).toBe(201);
    expect(linked.json().child.id).toBe(guest.user.id);
    expect(linked.json().child.linkStatus).toBe("active");

    const children = await app.inject({
      method: "GET",
      url: "/api/guardian/children",
      headers: { cookie: guardian.cookie },
    });

    expect(children.statusCode).toBe(200);
    expect(children.json().children).toEqual([linked.json().child]);
  });

  it("revokes a guardian link and immediately removes access to the child's data", async () => {
    const guest = await createGuest(app);
    const guardian = await registerGuardian(app, "unlink@example.com");
    await app.inject({
      method: "POST",
      url: "/api/guardian/children/link",
      headers: { cookie: guardian.cookie, "content-type": "application/json" },
      payload: { childId: guest.user.childId },
    });

    const unlinked = await app.inject({
      method: "DELETE",
      url: `/api/guardian/children/${guest.user.id}/link`,
      headers: { cookie: guardian.cookie },
    });
    expect(unlinked.statusCode).toBe(204);

    const children = await app.inject({
      method: "GET",
      url: "/api/guardian/children",
      headers: { cookie: guardian.cookie },
    });
    expect(children.json().children).toEqual([]);

    const denied = await app.inject({
      method: "GET",
      url: `/api/guardian/children/${guest.user.id}/projects`,
      headers: { cookie: guardian.cookie },
    });
    expect(denied.statusCode).toBe(403);
  });

  it("logs an existing guardian in and invalidates the session on logout", async () => {
    await registerGuardian(app, "login@example.com");

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/guardian/login",
      headers: { "content-type": "application/json" },
      payload: { email: "login@example.com", password: "build-together-123" },
    });

    expect(login.statusCode).toBe(200);
    expect(login.json().user.email).toBe("login@example.com");
    const setCookie = login.headers["set-cookie"];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(";")[0] ?? "";

    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/guardian/logout",
      headers: { cookie },
    });
    expect(logout.statusCode).toBe(204);

    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });

  it("does not allow an unrelated guardian to read a child's projects", async () => {
    const guest = await createGuest(app);
    const ownerGuardian = await registerGuardian(app, "owner@example.com");
    const otherGuardian = await registerGuardian(app, "other@example.com");

    await app.inject({
      method: "POST",
      url: "/api/guardian/children/link",
      headers: { cookie: ownerGuardian.cookie, "content-type": "application/json" },
      payload: { childId: guest.user.childId },
    });

    const denied = await app.inject({
      method: "GET",
      url: `/api/guardian/children/${guest.user.id}/projects`,
      headers: { cookie: otherGuardian.cookie },
    });

    expect(denied.statusCode).toBe(403);
  });

  it("returns six bounded creative-practice levels with evidence for a project insight", async () => {
    const guest = await createGuest(app);
    const guardian = await registerGuardian(app, "insight@example.com");
    await app.inject({
      method: "POST",
      url: "/api/guardian/children/link",
      headers: { cookie: guardian.cookie, "content-type": "application/json" },
      payload: { childId: guest.user.childId },
    });

    const projectResponse = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: {
        authorization: `Bearer ${guest.token}`,
        "content-type": "application/json",
      },
      payload: { prompt: "A penguin explores space and catches strawberries" },
    });
    expect(projectResponse.statusCode).toBe(201);
    const projectId = projectResponse.json().project.id as string;

    const insightResponse = await app.inject({
      method: "POST",
      url: `/api/guardian/children/${guest.user.id}/projects/${projectId}/insight`,
      headers: { cookie: guardian.cookie },
    });

    expect(insightResponse.statusCode).toBe(201);
    const radar = insightResponse.json().insight.radar;
    expect(radar.rubricVersion).toBe("creative-practice-v1");
    expect(radar.dimensions).toHaveLength(6);
    expect(radar.dimensions.map((dimension: { key: string }) => dimension.key)).toEqual([
      "imagination",
      "expression",
      "game_design",
      "experimentation",
      "iteration",
      "reflection",
    ]);
    for (const dimension of radar.dimensions) {
      expect(dimension.level).toBeGreaterThanOrEqual(0);
      expect(dimension.level).toBeLessThanOrEqual(4);
      expect(dimension.evidence.length).toBeGreaterThan(0);
    }
  });
});

async function createGuest(app: FastifyInstance): Promise<{
  token: string;
  user: { id: string; role: "child"; displayName: string; childId: string; linked: boolean };
}> {
  const response = await app.inject({ method: "POST", url: "/api/auth/child/guest" });
  expect(response.statusCode).toBe(201);
  return response.json();
}

async function registerGuardian(
  app: FastifyInstance,
  email: string,
): Promise<{ cookie: string; response: LightMyRequestResponse }> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/guardian/register",
    headers: { "content-type": "application/json" },
    payload: {
      displayName: "Maya's parent",
      email,
      password: "build-together-123",
    },
  });
  expect(response.statusCode).toBe(201);
  const setCookie = response.headers["set-cookie"];
  const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(";")[0];
  expect(cookie).toContain("imaginelab_session=");
  return { cookie: cookie ?? "", response };
}
