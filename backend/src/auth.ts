import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { FastifyRequest } from "fastify";
import type { AppConfig } from "./config.js";
import { type AuthenticatedUser, userRoleSchema } from "./domain.js";

function parseBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export class AuthService {
  public constructor(private readonly config: AppConfig) {
    if (config.authMode === "firebase" && getApps().length === 0) {
      initializeApp({ credential: applicationDefault() });
    }
  }

  public async authenticate(request: FastifyRequest): Promise<AuthenticatedUser> {
    if (this.config.authMode === "dev") {
      if (this.config.nodeEnv === "production") {
        throw new Error("AUTH_MODE=dev must never be used in production");
      }

      const rawId = request.headers["x-demo-user-id"];
      const rawRole = request.headers["x-demo-role"];
      const id = (Array.isArray(rawId) ? rawId[0] : rawId) ?? "demo-child";
      const role = userRoleSchema.parse(
        (Array.isArray(rawRole) ? rawRole[0] : rawRole) ?? "child",
      );
      return { id, role };
    }

    const token = parseBearerToken(request.headers.authorization);
    if (!token) {
      const error = new Error("A Firebase ID token is required");
      Object.assign(error, { statusCode: 401 });
      throw error;
    }

    const decoded = await getAuth().verifyIdToken(token, true);
    const role = userRoleSchema.safeParse(decoded.role);
    if (!role.success) {
      const error = new Error("The account does not have a valid child or guardian role");
      Object.assign(error, { statusCode: 403 });
      throw error;
    }

    return { id: decoded.uid, role: role.data };
  }
}
