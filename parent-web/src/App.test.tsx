import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';

describe('Parent Portal', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the guardian login when there is no active session', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'Sign in is required' }, 401)));

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /see the imagination behind every game/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows Portfolio, Activity, and Insights for a linked child', async () => {
    vi.stubGlobal('fetch', vi.fn(parentApiFixture));

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Portfolio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insights' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: "Maya's worlds" })).toBeInTheDocument();
  });

  it('shows the immutable version history in a project drawer', async () => {
    vi.stubGlobal('fetch', vi.fn(parentApiFixture));
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Space Penguin' }));
    expect(screen.getByRole('heading', { name: 'Version history' })).toBeInTheDocument();
    expect(screen.getByText('Version 2')).toBeInTheDocument();
    expect(screen.getByText('Version 1')).toBeInTheDocument();
  });

  it('renders the six creative-practice levels as an accessible radar and evidence list', async () => {
    vi.stubGlobal('fetch', vi.fn(parentApiFixture));
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Insights' }));

    expect(
      await screen.findByRole('img', { name: /creative practice radar/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Imagination')).toBeInTheDocument();
    expect(screen.getByText('Game Design')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reflection — Not enough evidence' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/not an educational or psychological assessment/i)).toBeInTheDocument();
  });

  it("shows one child-level insight across the portfolio without a project selector", async () => {
    const fetchMock = vi.fn(parentApiFixture);
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Insights' }));

    expect(
      await screen.findByRole('heading', { name: "Maya's creative portfolio" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Project evidence')).not.toBeInTheDocument();
    expect(screen.getByText('1 project · 0–4 evidence states')).toBeInTheDocument();
    expect(screen.getByText(/patterns across all available games/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Refresh child insight' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:8080/api/guardian/children/${child.id}/insight`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});

async function parentApiFixture(input: RequestInfo | URL): Promise<Response> {
  const url = String(input);
  if (url.endsWith('/api/auth/me')) {
    return jsonResponse({
      user: { id: 'guardian-1', role: 'guardian', displayName: "Maya's parent", email: 'parent@example.com' },
    });
  }
  if (url.endsWith('/api/guardian/children')) {
    return jsonResponse({ children: [child] });
  }
  if (url.endsWith(`/api/guardian/children/${child.id}/projects`)) {
    return jsonResponse({ projects: [project], activities: [activity] });
  }
  if (url.endsWith(`/api/guardian/children/${child.id}/insight`)) {
    return jsonResponse({ insight });
  }
  return jsonResponse({ error: `Unhandled test URL: ${url}` }, 404);
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const child = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'child',
  displayName: 'Maya',
  childId: 'KID-ABCD-2345',
  linked: true,
  linkStatus: 'active',
};

const project = {
  id: '22222222-2222-4222-8222-222222222222',
  childUserId: child.id,
  title: 'Space Penguin',
  status: 'draft',
  currentVersionId: '33333333-3333-4333-8333-333333333333',
  publishedVersionId: null,
  publicSlug: null,
  createdAt: '2026-07-18T12:00:00.000Z',
  updatedAt: '2026-07-19T12:00:00.000Z',
  currentVersion: {
    id: '33333333-3333-4333-8333-333333333333',
    projectId: '22222222-2222-4222-8222-222222222222',
    versionNumber: 2,
    prompt: 'Add three lives and a strawberry trail',
    html: '<!doctype html><html><body>Space Penguin</body></html>',
    createdAt: '2026-07-19T12:00:00.000Z',
  },
  versions: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      projectId: '22222222-2222-4222-8222-222222222222',
      versionNumber: 1,
      prompt: 'A penguin explores space',
      html: '<!doctype html><html><body>First Space Penguin</body></html>',
      createdAt: '2026-07-18T12:00:00.000Z',
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      projectId: '22222222-2222-4222-8222-222222222222',
      versionNumber: 2,
      prompt: 'Add three lives and a strawberry trail',
      html: '<!doctype html><html><body>Space Penguin</body></html>',
      createdAt: '2026-07-19T12:00:00.000Z',
    },
  ],
};

const activity = {
  id: '44444444-4444-4444-8444-444444444444',
  childUserId: child.id,
  projectId: project.id,
  type: 'edit',
  createdAt: '2026-07-19T12:00:00.000Z',
  metadata: { versionNumber: 2 },
};

const insight = {
  id: '55555555-5555-4555-8555-555555555555',
  childUserId: child.id,
  scope: 'portfolio',
  sourceProjectIds: [project.id],
  createdAt: '2026-07-19T12:00:00.000Z',
  summary: 'Patterns across all available games show how Maya turns playful themes into game ideas and returns to revise them.',
  dimensions: [
    { name: 'Creative exploration', observation: 'A distinct world was described.', evidence: ['Space penguin'] },
    { name: 'Iteration', observation: 'The game changed.', evidence: ['Added three lives'] },
  ],
  interests: ['space', 'animals'],
  conversationStarters: ['What would you add next?', 'Which change helped the player most?'],
  disclaimer: 'Portfolio-based observations — not an educational or psychological assessment.',
  radar: {
    rubricVersion: 'creative-practice-v1',
    dimensions: [
      radarValue('imagination', 3, 'Repeated'),
      radarValue('expression', 2, 'Demonstrated'),
      radarValue('game_design', 2, 'Demonstrated'),
      radarValue('experimentation', 1, 'Emerging'),
      radarValue('iteration', 2, 'Demonstrated'),
      radarValue('reflection', 0, 'Not enough evidence'),
    ],
  },
};

function radarValue(key: string, level: number, label: string) {
  return { key, level, label, observation: `${label} across the available portfolio.`, evidence: ['Space Penguin project evidence'] };
}
