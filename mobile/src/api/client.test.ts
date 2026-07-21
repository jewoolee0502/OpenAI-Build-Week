import { beforeEach, describe, expect, it, vi } from 'vitest';
import { imagineLabApi, resolveApiBaseUrl, resolveAudioUpload } from './client';

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
        if (url.endsWith('/builder/plan')) return jsonResponse({ draft: { ...builderDraft, creativePlan } });
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

  it('requests a persisted AI creative plan before drawing starts', async () => {
    const planned = await imagineLabApi.generateCreativePlan('private-child-token', projectId);

    expect(planned.creativePlan?.backgroundMission.title).toBe('Draw the moon garden');
    const fetchMock = vi.mocked(fetch);
    const options = fetchMock.mock.calls[0]?.[1];
    expect(options).toMatchObject({ method: 'POST' });
    expect(options?.body).toBeUndefined();
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer private-child-token' });
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

  it('uploads Expo high-quality mobile recordings as an M4A-compatible file', () => {
    expect(resolveAudioUpload('file:///recordings/idea.m4a', 'android')).toEqual({
      extension: 'm4a',
      fileName: 'voice-idea.m4a',
      mimeType: 'audio/mp4',
    });
  });

  it('keeps the recorder Blob format and removes codec parameters on web', () => {
    expect(resolveAudioUpload('blob:http://localhost/recording', 'web', 'audio/webm;codecs=opus')).toEqual({
      extension: 'webm',
      fileName: 'voice-idea.webm',
      mimeType: 'audio/webm',
    });
  });
});

const projectId = '22222222-2222-4222-8222-222222222222';
const builderDraft = {
  stage: 'build' as const,
  creativePlan: null,
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

const creativePlan = {
  projectTitle: 'Moon Garden',
  ideaSummary: 'A moon garden can become a cozy game or a collecting challenge.',
  gameDirections: [
    { title: 'Grow and explore', mechanic: 'Find seeds and choose where they grow.', creativeTwist: 'The plants can react to moonlight.' },
    { title: 'Catch the glow', mechanic: 'Collect drifting lights.', creativeTwist: 'Each color can change the garden.' },
  ],
  backgroundMission: {
    title: 'Draw the moon garden',
    prompt: 'Show where the garden grows and what the sky feels like.',
    possibilities: ['crater flowers', 'a glass greenhouse'],
  },
  elementMissions: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      suggestedName: 'Moon seed',
      prompt: 'Invent a seed that belongs on the moon.',
      purpose: 'It can give the player something to collect.',
      possibilities: ['a glowing seed', 'a sleepy seed'],
    },
    {
      id: '55555555-5555-4555-8555-555555555555',
      suggestedName: 'Garden helper',
      prompt: 'Draw someone or something that helps the garden.',
      purpose: 'It can guide or surprise the player.',
      possibilities: ['a robot', 'a moon moth'],
    },
  ],
  encouragement: 'Use, change, or ignore every spark.',
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
