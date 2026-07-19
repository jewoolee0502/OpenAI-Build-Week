import { z } from "zod";

export const userRoleSchema = z.enum(["child", "guardian"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const projectStatusSchema = z.enum(["draft", "published"]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const activityTypeSchema = z.enum([
  "create",
  "edit",
  "publish",
  "unpublish",
  "insight_generated",
]);
export type ActivityType = z.infer<typeof activityTypeSchema>;

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
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
  createdAt: string;
  updatedAt: string;
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

export const projectInsightSchema = z.object({
  summary: z.string().min(1).max(800),
  dimensions: z.array(insightDimensionSchema).min(2).max(5),
  interests: z.array(z.string().min(1).max(80)).max(5),
  conversationStarters: z.array(z.string().min(1).max(240)).min(2).max(4),
  disclaimer: z.string().min(1).max(400),
});
export type ProjectInsightContent = z.infer<typeof projectInsightSchema>;

export interface ProjectInsight extends ProjectInsightContent {
  id: string;
  projectId: string;
  childUserId: string;
  createdAt: string;
}

export interface ProjectWithCurrentVersion extends Project {
  currentVersion: ProjectVersion;
}

export interface DatabaseShape {
  projects: Project[];
  versions: ProjectVersion[];
  activities: ActivityEvent[];
  insights: ProjectInsight[];
  guardianLinks: Array<{
    guardianUserId: string;
    childUserId: string;
    status: "active" | "pending";
  }>;
}

export const createProjectBodySchema = z.object({
  prompt: z.string().trim().min(3).max(1_500),
});

export const editProjectBodySchema = z.object({
  instruction: z.string().trim().min(2).max(1_000),
});
