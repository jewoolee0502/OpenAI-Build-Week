import { Platform } from 'react-native';

import type {
  BuilderDraft,
  ChildAccount,
  GameProject,
  GuestSession,
  ProjectMutationResponse,
  PublishResponse,
} from '@/api/types';

const platformDefaultUrl = Platform.select({
  android: 'http://10.0.2.2:8080',
  default: 'http://localhost:8080',
});

const configuredMobileUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const configuredWebUrl = process.env.EXPO_PUBLIC_WEB_API_BASE_URL?.trim();

export function resolveApiBaseUrl(
  platform: string,
  mobileUrl: string | undefined,
  webUrl: string | undefined,
  nativeDefaultUrl: string | undefined,
): string | undefined {
  return (
    platform === 'web'
      ? webUrl || mobileUrl || 'http://localhost:8080'
      : mobileUrl || nativeDefaultUrl
  )?.replace(/\/$/, '');
}

export const apiBaseUrl = resolveApiBaseUrl(
  Platform.OS,
  configuredMobileUrl,
  configuredWebUrl,
  platformDefaultUrl,
);

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const audioMimeByExtension: Record<string, string> = {
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  mpeg: 'audio/mpeg',
  mpga: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  webm: 'audio/webm',
};

const audioExtensionByMime: Record<string, string> = {
  'audio/flac': 'flac',
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/x-flac': 'flac',
  'audio/x-m4a': 'm4a',
  'audio/x-wav': 'wav',
};

export function resolveAudioUpload(
  uri: string,
  platform: string,
  reportedMimeType?: string,
): { extension: string; mimeType: string; fileName: string } {
  const cleanMimeType = reportedMimeType?.split(';')[0]?.trim().toLowerCase();
  const uriExtension = uri.split(/[?#]/)[0]?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const extension =
    (uriExtension && audioMimeByExtension[uriExtension] ? uriExtension : undefined) ??
    (cleanMimeType ? audioExtensionByMime[cleanMimeType] : undefined) ??
    (platform === 'web' ? 'webm' : 'm4a');
  const mimeType = audioMimeByExtension[extension] ?? (platform === 'web' ? 'audio/webm' : 'audio/mp4');
  return { extension, mimeType, fileName: `voice-idea.${extension}` };
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown> | FormData;
    token?: string;
  },
): Promise<T> {
  if (!apiBaseUrl) throw new ApiError('ImagineLab API address is not configured.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  const isMultipart = options.body instanceof FormData;
  const requestBody: BodyInit | undefined = options.body instanceof FormData
    ? options.body
    : options.body
      ? JSON.stringify(options.body)
      : undefined;
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.body && !isMultipart ? { 'Content-Type': 'application/json' } : {}),
      },
      body: requestBody,
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new ApiError(payload?.error || `ImagineLab API returned ${response.status}.`, response.status);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('ImagineLab took too long to respond. Please try again.');
    }
    throw new ApiError(
      `Could not reach ImagineLab at ${apiBaseUrl}. Keep this device on the same Wi-Fi as the backend computer.`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const imagineLabApi = {
  createGuest(): Promise<GuestSession> {
    return request('/api/auth/child/guest', { method: 'POST' });
  },

  async getMe(token: string): Promise<ChildAccount> {
    const response = await request<{ user: ChildAccount }>('/api/auth/me', { token });
    return response.user;
  },

  async listChildProjects(token: string): Promise<GameProject[]> {
    const response = await request<{ projects: GameProject[] }>('/api/projects', { token });
    return response.projects;
  },

  createProject(token: string, prompt: string): Promise<ProjectMutationResponse> {
    return request('/api/projects', { method: 'POST', body: { prompt }, token });
  },

  editProject(token: string, projectId: string, instruction: string): Promise<ProjectMutationResponse> {
    return request(`/api/projects/${projectId}/edits`, {
      method: 'POST',
      body: { instruction },
      token,
    });
  },

  publishProject(token: string, projectId: string): Promise<PublishResponse> {
    return request(`/api/projects/${projectId}/publish`, { method: 'POST', token });
  },

  unpublishProject(token: string, projectId: string): Promise<void> {
    return request(`/api/projects/${projectId}/publish`, { method: 'DELETE', token });
  },

  deleteProject(token: string, projectId: string): Promise<void> {
    return request(`/api/projects/${projectId}`, { method: 'DELETE', token });
  },

  async loadBuilderDraft(token: string, projectId: string): Promise<BuilderDraft | null> {
    const response = await request<{ draft: BuilderDraft | null }>(`/api/projects/${projectId}/builder`, { token });
    return response.draft;
  },

  async saveBuilderDraft(token: string, projectId: string, draft: BuilderDraft): Promise<BuilderDraft> {
    const response = await request<{ draft: BuilderDraft }>(`/api/projects/${projectId}/builder`, { method: 'PUT', body: { draft }, token });
    return response.draft;
  },

  async generateCreativePlan(token: string, projectId: string): Promise<BuilderDraft> {
    const response = await request<{ draft: BuilderDraft }>(`/api/projects/${projectId}/builder/plan`, { method: 'POST', token });
    return response.draft;
  },

  async generateSceneVariants(token: string, projectId: string): Promise<BuilderDraft> {
    const response = await request<{ draft: BuilderDraft }>(`/api/projects/${projectId}/builder/variants`, { method: 'POST', token });
    return response.draft;
  },

  testBuilderGame(token: string, projectId: string): Promise<ProjectMutationResponse> {
    return request(`/api/projects/${projectId}/builder/test`, { method: 'POST', token });
  },

  async transcribeAudio(token: string, uri: string): Promise<string> {
    const form = new FormData();
    if (Platform.OS === 'web') {
      const recordingResponse = await fetch(uri);
      const recordingBlob = await recordingResponse.blob();
      const metadata = resolveAudioUpload(uri, Platform.OS, recordingBlob.type);
      form.append('file', recordingBlob, metadata.fileName);
    } else {
      const metadata = resolveAudioUpload(uri, Platform.OS);
      form.append(
        'file',
        {
          uri,
          name: metadata.fileName,
          type: metadata.mimeType,
        } as unknown as Blob,
      );
    }
    const response = await request<{ text: string }>('/api/transcriptions', {
      method: 'POST',
      body: form,
      token,
    });
    return response.text;
  },
};
