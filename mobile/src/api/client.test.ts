import { beforeEach, describe, expect, it, vi } from 'vitest';
import { imagineLabApi, resolveApiBaseUrl } from './client';

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
        if (url.endsWith('/builder/variants')) return jsonResponse({ draft: builderDraft });
        if (url.endsWith('/builder')) return jsonResponse({ draft: builderDraft });
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

  it('saves a canvas draft and requests visual interpretations with bearer authentication', async () => {
    await imagineLabApi.saveBuilderDraft('private-child-token', projectId, builderDraft);
    await imagineLabApi.generateSceneVariants('private-child-token', projectId);

    const fetchMock = vi.mocked(fetch);
    const saveOptions = fetchMock.mock.calls[0]?.[1];
    expect(saveOptions).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ draft: builderDraft }),
    });
    expect(saveOptions?.headers).toMatchObject({
      Authorization: 'Bearer private-child-token',
      'Content-Type': 'application/json',
    });

    const variantsOptions = fetchMock.mock.calls[1]?.[1];
    expect(variantsOptions).toMatchObject({ method: 'POST' });
    expect(variantsOptions?.body).toBeUndefined();
    expect(variantsOptions?.headers).toMatchObject({ Authorization: 'Bearer private-child-token' });
    expect((variantsOptions?.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('uses the LAN mobile API address when Expo Web is opened from a phone', () => {
    expect(
      resolveApiBaseUrl('web', 'http://10.0.0.92:8080', undefined, 'http://localhost:8080'),
    ).toBe('http://10.0.0.92:8080');
  });

  it('keeps an explicit web API address as the highest-priority web override', () => {
    expect(
      resolveApiBaseUrl(
        'web',
        'http://10.0.0.92:8080',
        'http://localhost:8080/',
        'http://localhost:8080',
      ),
    ).toBe('http://localhost:8080');
  });
});

const projectId = '22222222-2222-4222-8222-222222222222';
const builderDraft = {
  stage: 'build' as const,
  interpretationStatus: 'pending' as const,
  interpretation: 'The bird follows the player and collects seeds.',
  assets: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      kind: 'background' as const,
      name: 'My forest',
      imageDataUrl: 'data:image/png;base64,abc',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      zIndex: 0,
    },
  ],
  variants: [],
  selectedVariantId: null,
  updatedAt: '2026-07-20T00:00:00.000Z',
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
