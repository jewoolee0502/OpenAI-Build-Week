import { z } from "zod";

export const userRoleSchema = z.enum(["child", "guardian"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const projectStatusSchema = z.enum(["draft", "published"]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const activityTypeSchema = z.enum([
  "create",
  "edit",
  "playtest",
  "reflection",
  "publish",
  "unpublish",
  "insight_generated",
]);
export type ActivityType = z.infer<typeof activityTypeSchema>;

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  displayName: string;
  childId?: string;
  linked?: boolean;
}

export interface ChildAccount {
  id: string;
  role: "child";
  displayName: string;
  childId: string;
  linked: boolean;
}

export interface GuardianAccount {
  id: string;
  role: "guardian";
  displayName: string;
  email: string;
}

export interface LinkedChild extends ChildAccount {
  linkStatus: "active" | "pending" | "revoked";
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  prompt: string;
  html: string;
  createdAt: string;
}

export interface Project {
  id: string;
  childUserId: string;
  title: string;
  status: ProjectStatus;
  currentVersionId: string;
  publishedVersionId: string | null;
  publicSlug: string | null;
  profileImageUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectProfileImage {
  id: string;
  projectId: string;
  sourcePrompt: string;
  mimeType: "image/webp" | "image/svg+xml";
  data: Buffer;
  provider: "openai" | "demo";
  model: string;
  fallbackReason: "moderation_blocked" | "provider_error" | null;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  childUserId: string;
  projectId: string;
  type: ActivityType;
  createdAt: string;
  metadata: Record<string, string | number | boolean | null>;
}

export const insightDimensionSchema = z.object({
  name: z.string().min(1).max(60),
  observation: z.string().min(1).max(500),
  evidence: z.array(z.string().min(1).max(240)).min(1).max(3),
});

export const creativeDimensionKeySchema = z.enum([
  "imagination",
  "expression",
  "game_design",
  "experimentation",
  "iteration",
  "reflection",
]);
export type CreativeDimensionKey = z.infer<typeof creativeDimensionKeySchema>;

export const evidenceLevelSchema = z.number().int().min(0).max(4);
export const evidenceLabelSchema = z.enum([
  "Not enough evidence",
  "Emerging",
  "Demonstrated",
  "Repeated",
  "Sustained",
]);

const creativeDimensionOrder = [
  "imagination",
  "expression",
  "game_design",
  "experimentation",
  "iteration",
  "reflection",
] as const;

const radarDimensionSchema = z.object({
  key: creativeDimensionKeySchema,
  level: evidenceLevelSchema,
  label: evidenceLabelSchema,
  observation: z.string().min(1).max(500),
  evidence: z.array(z.string().min(1).max(240)).min(1).max(3),
});

const radarDimensionsSchema = z
  .array(radarDimensionSchema)
  .length(creativeDimensionOrder.length)
  .superRefine((dimensions, context) => {
    creativeDimensionOrder.forEach((key, index) => {
      if (dimensions[index]?.key !== key) {
        context.addIssue({
          code: "custom",
          path: [index, "key"],
          message: `Expected ${key} at radar position ${index + 1}`,
        });
      }
    });
  });

export const creativePracticeRadarSchema = z.object({
  rubricVersion: z.literal("creative-practice-v1"),
  dimensions: radarDimensionsSchema,
});
export type CreativePracticeRadar = z.infer<typeof creativePracticeRadarSchema>;

export const projectInsightSchema = z.object({
  summary: z.string().min(1).max(800),
  dimensions: z.array(insightDimensionSchema).min(2).max(5),
  interests: z.array(z.string().min(1).max(80)).max(5),
  conversationStarters: z.array(z.string().min(1).max(240)).min(2).max(4),
  disclaimer: z.string().min(1).max(400),
  radar: creativePracticeRadarSchema,
});
export type ProjectInsightContent = z.infer<typeof projectInsightSchema>;

export interface ProjectInsight extends ProjectInsightContent {
  id: string;
  projectId: string;
  childUserId: string;
  createdAt: string;
}

export interface ChildInsight extends ProjectInsightContent {
  id: string;
  childUserId: string;
  scope: "portfolio";
  sourceProjectIds: string[];
  createdAt: string;
}

export interface ProjectWithCurrentVersion extends Project {
  currentVersion: ProjectVersion;
}

export const createProjectBodySchema = z.object({
  prompt: z.string().trim().min(3).max(1_500),
});

export const editProjectBodySchema = z.object({
  instruction: z.string().trim().min(2).max(1_000),
});

export const guardianRegistrationBodySchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(128),
});

export const guardianLoginBodySchema = guardianRegistrationBodySchema.pick({
  email: true,
  password: true,
});

export const linkChildBodySchema = z.object({
  childId: z.string().trim().toUpperCase().regex(/^KID-[A-Z2-9]{4}-[A-Z2-9]{4}$/),
});
