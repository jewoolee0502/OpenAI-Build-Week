export type ProjectStatus = 'draft' | 'published';

export interface GuardianUser {
  id: string;
  role: 'guardian';
  displayName: string;
  email: string;
}

export interface LinkedChild {
  id: string;
  role: 'child';
  displayName: string;
  childId: string;
  linked: boolean;
  linkStatus: 'active' | 'pending' | 'revoked';
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
  versions: GameVersion[];
}

export type ActivityType =
  | 'create'
  | 'edit'
  | 'playtest'
  | 'reflection'
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

export type CreativeDimensionKey =
  | 'imagination'
  | 'expression'
  | 'game_design'
  | 'experimentation'
  | 'iteration'
  | 'reflection';

export interface CreativeDimensionValue {
  key: CreativeDimensionKey;
  level: 0 | 1 | 2 | 3 | 4;
  label: 'Not enough evidence' | 'Emerging' | 'Demonstrated' | 'Repeated' | 'Sustained';
  observation: string;
  evidence: string[];
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
  radar: {
    rubricVersion: 'creative-practice-v1';
    dimensions: [
      CreativeDimensionValue,
      CreativeDimensionValue,
      CreativeDimensionValue,
      CreativeDimensionValue,
      CreativeDimensionValue,
      CreativeDimensionValue,
    ];
  };
}

export interface GuardianDashboard {
  projects: GameProject[];
  activities: ActivityEvent[];
}
