import { beforeEach, describe, expect, it, vi } from 'vitest';
import { imagineLabApi } from './client';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (options: Record<string, string>) => options.android ?? options.default,
  },
}));

describe('child API authentication', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/auth/child/guest')) {
          return jsonResponse({
            token: 'private-child-token',
            user: {
              id: '11111111-1111-4111-8111-111111111111',
              role: 'child',
              displayName: 'Guest Creator',
              childId: 'KID-ABCD-2345',
              linked: false,
            },
          }, 201);
        }
        return jsonResponse({ projects: [] });
      }),
    );
  });

  it('creates a guest child session through the backend', async () => {
    const createGuest = (imagineLabApi as unknown as {
      createGuest?: () => Promise<{ token: string; user: { childId: string } }>;
    }).createGuest;

    expect(typeof createGuest).toBe('function');
    const session = await createGuest!();
    expect(session.token).toBe('private-child-token');
    expect(session.user.childId).toBe('KID-ABCD-2345');
  });

  it('uses the private bearer token and never sends demo identity headers', async () => {
    const listProjects = imagineLabApi.listChildProjects as unknown as (
      token: string,
    ) => Promise<unknown>;
    await listProjects('private-child-token');

    const fetchMock = vi.mocked(fetch);
    const options = fetchMock.mock.calls[0]?.[1];
    const headers = options?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer private-child-token');
    expect(headers['X-Demo-User-Id']).toBeUndefined();
    expect(headers['X-Demo-Role']).toBeUndefined();
  });
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
