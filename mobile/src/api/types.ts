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

export interface GenerationSummary {
  provider: 'openai' | 'demo';
  summary: string;
}

export interface ProjectMutationResponse {
  project: GameProject;
  generation: GenerationSummary;
}

export interface PublishResponse {
  project: GameProject;
  publicUrl: string;
}
