import type { GuardianDashboard, ProjectInsight } from './types';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8080').replace(
  /\/$/,
  '',
);

class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'X-Demo-User-Id': 'demo-guardian',
        'X-Demo-Role': 'guardian',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new ApiError(payload?.error || `ImagineLab API returned ${response.status}.`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('ImagineLab took too long to respond. Please try again.');
    }
    throw new ApiError('Could not reach ImagineLab. Make sure the backend is running.');
  } finally {
    window.clearTimeout(timeout);
  }
}

const childId = 'demo-child';

export const parentApi = {
  loadDashboard(): Promise<GuardianDashboard> {
    return request(`/api/guardian/children/${childId}/projects`);
  },

  async loadInsight(projectId: string): Promise<ProjectInsight | null> {
    const response = await request<{ insight: ProjectInsight | null }>(
      `/api/guardian/children/${childId}/projects/${projectId}/insight`,
    );
    return response.insight;
  },

  async generateInsight(projectId: string): Promise<ProjectInsight> {
    const response = await request<{ insight: ProjectInsight }>(
      `/api/guardian/children/${childId}/projects/${projectId}/insight`,
      'POST',
    );
    return response.insight;
  },
};
