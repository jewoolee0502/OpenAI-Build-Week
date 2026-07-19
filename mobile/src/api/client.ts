import { Platform } from 'react-native';

import type {
  GameProject,
  ProjectMutationResponse,
  PublishResponse,
} from '@/api/types';

const platformDefaultUrl = Platform.select({
  android: 'http://10.0.2.2:8080',
  default: 'http://localhost:8080',
});

export const apiBaseUrl = (
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || platformDefaultUrl
)?.replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: Record<string, string> | FormData;
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
        'X-Demo-User-Id': 'demo-child',
        'X-Demo-Role': 'child',
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
  async listChildProjects(): Promise<GameProject[]> {
    const response = await request<{ projects: GameProject[] }>('/api/projects', {});
    return response.projects;
  },

  createProject(prompt: string): Promise<ProjectMutationResponse> {
    return request('/api/projects', { method: 'POST', body: { prompt } });
  },

  editProject(projectId: string, instruction: string): Promise<ProjectMutationResponse> {
    return request(`/api/projects/${projectId}/edits`, {
      method: 'POST',
      body: { instruction },
    });
  },

  publishProject(projectId: string): Promise<PublishResponse> {
    return request(`/api/projects/${projectId}/publish`, { method: 'POST' });
  },

  unpublishProject(projectId: string): Promise<void> {
    return request(`/api/projects/${projectId}/publish`, { method: 'DELETE' });
  },

  async transcribeAudio(uri: string): Promise<string> {
    const isWebRecording = Platform.OS === 'web';
    const form = new FormData();
    form.append(
      'file',
      {
        uri,
        name: `voice-idea.${isWebRecording ? 'webm' : 'm4a'}`,
        type: isWebRecording ? 'audio/webm' : 'audio/mp4',
      } as unknown as Blob,
    );
    const response = await request<{ text: string }>('/api/transcriptions', {
      method: 'POST',
      body: form,
    });
    return response.text;
  },
};
