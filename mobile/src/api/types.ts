export type ProjectStatus = 'draft' | 'published';
export type BuilderStage = 'build' | 'choose_design' | 'test' | 'ready_to_publish';

export interface CanvasAsset {
  id: string;
  kind: 'background' | 'object';
  name: string;
  imageDataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface SceneVariant {
  id: string;
  title: string;
  description: string;
  previewDataUrl: string;
}

export interface BuilderDraft {
  stage: BuilderStage;
  interpretationStatus: 'pending' | 'ready' | 'failed';
  interpretation: string | null;
  assets: CanvasAsset[];
  variants: SceneVariant[];
  selectedVariantId: string | null;
  updatedAt: string;
}

export interface ChildAccount {
  id: string;
  role: 'child';
  displayName: string;
  childId: string;
  linked: boolean;
}

export interface GuestSession {
  token: string;
  user: ChildAccount;
}

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
  builder?: BuilderDraft;
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
