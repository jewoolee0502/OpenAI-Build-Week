import type { FastifyRequest } from "fastify";
import type { AppConfig } from "./config.js";
import { type AuthenticatedUser, userRoleSchema } from "./domain.js";

export class AuthService {
  public constructor(private readonly config: AppConfig) {}

  public async authenticate(request: FastifyRequest): Promise<AuthenticatedUser> {
    if (this.config.nodeEnv === "production") {
      const error = new Error("Production authentication has not been configured");
      Object.assign(error, { statusCode: 503 });
      throw error;
    }

    const rawId = request.headers["x-demo-user-id"];
    const rawRole = request.headers["x-demo-role"];
    const id = (Array.isArray(rawId) ? rawId[0] : rawId) ?? "demo-child";
    const role = userRoleSchema.parse(
      (Array.isArray(rawRole) ? rawRole[0] : rawRole) ?? "child",
    );
    return { id, role };
  }
}
