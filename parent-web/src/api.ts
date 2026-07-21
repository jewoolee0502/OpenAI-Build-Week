import type {
  GuardianDashboard,
  GuardianUser,
  LinkedChild,
  ChildInsight,
} from './types';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8080').replace(
  /\/$/,
  '',
);

export function publicGameUrl(slug: string): string {
  return `${apiBaseUrl}/g/${encodeURIComponent(slug)}`;
}

export function backendAssetUrl(path: string): string {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

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
  options: { method?: 'GET' | 'POST' | 'DELETE'; body?: Record<string, string> } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new ApiError(
        payload?.error || `ImagineLab API returned ${response.status}.`,
        response.status,
      );
    }

    if (response.status === 204) return undefined as T;
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

export const parentApi = {
  async me(): Promise<GuardianUser> {
    const response = await request<{ user: GuardianUser }>('/api/auth/me');
    return response.user;
  },

  async login(email: string, password: string): Promise<GuardianUser> {
    const response = await request<{ user: GuardianUser }>('/api/auth/guardian/login', {
      method: 'POST',
      body: { email, password },
    });
    return response.user;
  },

  async register(displayName: string, email: string, password: string): Promise<GuardianUser> {
    const response = await request<{ user: GuardianUser }>('/api/auth/guardian/register', {
      method: 'POST',
      body: { displayName, email, password },
    });
    return response.user;
  },

  logout(): Promise<void> {
    return request('/api/auth/guardian/logout', { method: 'POST' });
  },

  async listChildren(): Promise<LinkedChild[]> {
    const response = await request<{ children: LinkedChild[] }>('/api/guardian/children');
    return response.children;
  },

  async linkChild(childId: string): Promise<LinkedChild> {
    const response = await request<{ child: LinkedChild }>('/api/guardian/children/link', {
      method: 'POST',
      body: { childId },
    });
    return response.child;
  },

  unlinkChild(childUserId: string): Promise<void> {
    return request(`/api/guardian/children/${childUserId}/link`, { method: 'DELETE' });
  },

  loadDashboard(childUserId: string): Promise<GuardianDashboard> {
    return request(`/api/guardian/children/${childUserId}/projects`);
  },

  async loadInsight(childUserId: string): Promise<ChildInsight | null> {
    const response = await request<{ insight: ChildInsight | null }>(
      `/api/guardian/children/${childUserId}/insight`,
    );
    return response.insight;
  },

  async generateInsight(childUserId: string): Promise<ChildInsight> {
    const response = await request<{ insight: ChildInsight }>(
      `/api/guardian/children/${childUserId}/insight`,
      { method: 'POST' },
    );
    return response.insight;
  },
};
