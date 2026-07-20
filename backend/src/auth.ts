import { createHash, randomBytes } from "node:crypto";
import { hash as hashPassword, verify as verifyPassword } from "argon2";
import type { FastifyRequest } from "fastify";
import type { AppConfig } from "./config.js";
import type { AuthenticatedUser, ChildAccount, GuardianAccount } from "./domain.js";
import type { ApplicationStore } from "./store.js";

export const guardianSessionCookie = "imaginelab_session";
const childSessionDurationMs = 365 * 24 * 60 * 60 * 1000;
const guardianSessionDurationMs = 7 * 24 * 60 * 60 * 1000;
const childIdAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function parseBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export interface IssuedChildSession {
  token: string;
  user: ChildAccount;
}

export interface IssuedGuardianSession {
  token: string;
  user: GuardianAccount;
}

export class AuthService {
  public constructor(
    private readonly config: AppConfig,
    private readonly store: ApplicationStore,
  ) {}

  public async createGuest(): Promise<IssuedChildSession> {
    const token = sessionToken();
    const user = await this.store.createGuestChild({
      childId: createChildId(),
      displayName: "Guest Creator",
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + childSessionDurationMs),
    });
    return { token, user };
  }

  public async registerGuardian(input: {
    displayName: string;
    email: string;
    password: string;
  }): Promise<IssuedGuardianSession> {
    const passwordHash = await hashPassword(input.password, { type: 2 });
    const user = await this.store.createGuardian({
      displayName: input.displayName,
      email: input.email,
      passwordHash,
    });
    return this.issueGuardianSession(user);
  }

  public async loginGuardian(input: {
    email: string;
    password: string;
  }): Promise<IssuedGuardianSession> {
    const credentials = await this.store.findGuardianCredentials(input.email);
    if (!credentials || !(await verifyPassword(credentials.passwordHash, input.password))) {
      throw authError("Email or password is incorrect");
    }
    const { passwordHash: _passwordHash, ...user } = credentials;
    return this.issueGuardianSession(user);
  }

  public async authenticate(request: FastifyRequest): Promise<AuthenticatedUser> {
    const bearerToken = parseBearerToken(request.headers.authorization);
    if (bearerToken) {
      const user = await this.store.findSessionUser(tokenHash(bearerToken), "child_guest");
      if (!user || user.role !== "child") throw authError("The child session is invalid or expired");
      return user;
    }

    const cookieToken = request.cookies[guardianSessionCookie];
    if (cookieToken) {
      const user = await this.store.findSessionUser(tokenHash(cookieToken), "guardian_web");
      if (!user || user.role !== "guardian") {
        throw authError("The guardian session is invalid or expired");
      }
      return user;
    }

    throw authError("Sign in is required");
  }

  public async revokeGuardianSession(request: FastifyRequest): Promise<void> {
    const token = request.cookies[guardianSessionCookie];
    if (token) await this.store.revokeSession(tokenHash(token));
  }

  public cookieOptions(): {
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: "/";
    maxAge: number;
  } {
    return {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.nodeEnv === "production",
      path: "/",
      maxAge: guardianSessionDurationMs / 1000,
    };
  }

  private async issueGuardianSession(user: GuardianAccount): Promise<IssuedGuardianSession> {
    const token = sessionToken();
    await this.store.createSession({
      userId: user.id,
      tokenHash: tokenHash(token),
      kind: "guardian_web",
      expiresAt: new Date(Date.now() + guardianSessionDurationMs),
    });
    return { token, user };
  }
}

function createChildId(): string {
  const bytes = randomBytes(8);
  const value = Array.from(bytes, (byte) => childIdAlphabet[byte % childIdAlphabet.length]).join("");
  return `KID-${value.slice(0, 4)}-${value.slice(4)}`;
}

function sessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function authError(message: string): Error {
  const error = new Error(message);
  Object.assign(error, { statusCode: 401 });
  return error;
}
