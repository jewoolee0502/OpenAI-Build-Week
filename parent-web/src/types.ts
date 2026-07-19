export type ProjectStatus = 'draft' | 'published';

export interface GameVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  prompt: string;
  html: string;
  createdAt: string;
}

export interface GameProject {
  id: string;
  childUserId: string;
  title: string;
  status: ProjectStatus;
  currentVersionId: string;
  publishedVersionId: string | null;
  publicSlug: string | null;
  createdAt: string;
  updatedAt: string;
  currentVersion: GameVersion;
}

export type ActivityType =
  | 'create'
  | 'edit'
  | 'publish'
  | 'unpublish'
  | 'insight_generated';

export interface ActivityEvent {
  id: string;
  childUserId: string;
  projectId: string;
  type: ActivityType;
  createdAt: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface ProjectInsight {
  id: string;
  projectId: string;
  childUserId: string;
  createdAt: string;
  summary: string;
  dimensions: Array<{
    name: string;
    observation: string;
    evidence: string[];
  }>;
  interests: string[];
  conversationStarters: string[];
  disclaimer: string;
}

export interface GuardianDashboard {
  projects: GameProject[];
  activities: ActivityEvent[];
}
