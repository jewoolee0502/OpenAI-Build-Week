import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, parentApi, publicGameUrl } from './api';
import type {
  ActivityEvent,
  CreativeDimensionKey,
  CreativeDimensionValue,
  GameProject,
  GuardianDashboard,
  GuardianUser,
  LinkedChild,
  ProjectInsight,
} from './types';
import './App.css';

type PortalPage = 'portfolio' | 'activity' | 'insights';

const emptyDashboard: GuardianDashboard = { projects: [], activities: [] };

function App() {
  const [guardian, setGuardian] = useState<GuardianUser | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void parentApi
      .me()
      .then((user) => {
        if (active) setGuardian(user);
      })
      .catch((error: unknown) => {
        if (active && error instanceof ApiError && error.statusCode === 401) setGuardian(null);
        else if (active) setGuardian(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (guardian === undefined) return <LoadingScreen />;
  if (guardian === null) return <AuthScreen onAuthenticated={setGuardian} />;
  return <Portal guardian={guardian} onSignedOut={() => setGuardian(null)} />;
}

function LoadingScreen() {
  return (
    <main className="center-screen" aria-live="polite">
      <Brand />
      <span className="loading-orbit" aria-hidden="true">✦</span>
      <p>Opening the parent portal…</p>
    </main>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: GuardianUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const user =
          mode === 'login'
            ? await parentApi.login(email.trim(), password)
            : await parentApi.register(displayName.trim(), email.trim(), password);
        onAuthenticated(user);
      } catch (submissionError) {
        setError(messageFrom(submissionError));
      } finally {
        setSubmitting(false);
      }
    },
    [displayName, email, mode, onAuthenticated, password],
  );

  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div>
          <p className="eyebrow">PARENT PORTAL</p>
          <h1>See the imagination behind every game.</h1>
          <p>
            Follow the ideas, experiments, and thoughtful revisions behind your child&apos;s
            ImagineLab worlds.
          </p>
        </div>
        <div className="auth-stars" aria-hidden="true">✦　☆　✧</div>
      </section>

      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">WELCOME</p>
        <h2 id="auth-title">{mode === 'login' ? 'Sign in to ImagineLab' : 'Create a parent account'}</h2>
        <p className="muted">
          {mode === 'login'
            ? 'Use the parent account connected to your child.'
            : 'You can connect a child with their Child ID after registration.'}
        </p>
        <form onSubmit={(event) => void submit(event)}>
          {mode === 'register' ? (
            <label>
              Your name
              <input
                autoComplete="name"
                onChange={(event) => setDisplayName(event.target.value)}
                required
                value={displayName}
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={10}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="primary-button wide" disabled={submitting} type="submit">
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button
          className="switch-auth"
          onClick={() => setMode((current) => (current === 'login' ? 'register' : 'login'))}
          type="button"
        >
          {mode === 'login' ? 'New here? Create a parent account' : 'Already registered? Sign in'}
        </button>
      </section>
    </main>
  );
}

function Portal({ guardian, onSignedOut }: { guardian: GuardianUser; onSignedOut: () => void }) {
  const [page, setPage] = useState<PortalPage>('portfolio');
  const [children, setChildren] = useState<LinkedChild[] | undefined>(undefined);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<GuardianDashboard>(emptyDashboard);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);

  const selectedChild = useMemo(
    () => children?.find((child) => child.id === selectedChildId) ?? null,
    [children, selectedChildId],
  );

  const loadChildren = useCallback(async () => {
    setError(null);
    try {
      const linkedChildren = await parentApi.listChildren();
      setChildren(linkedChildren);
      setSelectedChildId((current) => current ?? linkedChildren[0]?.id ?? null);
      if (linkedChildren.length === 0) setShowLinkForm(true);
    } catch (loadError) {
      setError(messageFrom(loadError));
      setChildren([]);
    }
  }, []);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    if (!selectedChildId) {
      setDashboard(emptyDashboard);
      return;
    }
    let active = true;
    setLoadingDashboard(true);
    setError(null);
    void parentApi
      .loadDashboard(selectedChildId)
      .then((result) => {
        if (active) setDashboard(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(messageFrom(loadError));
      })
      .finally(() => {
        if (active) setLoadingDashboard(false);
      });
    return () => {
      active = false;
    };
  }, [selectedChildId]);

  const signOut = useCallback(async () => {
    try {
      await parentApi.logout();
    } finally {
      onSignedOut();
    }
  }, [onSignedOut]);

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <Brand />
        <nav aria-label="Parent portal pages" className="main-nav">
          {(['portfolio', 'activity', 'insights'] as const).map((item) => (
            <button
              aria-current={page === item ? 'page' : undefined}
              className={page === item ? 'active' : ''}
              key={item}
              onClick={() => setPage(item)}
              type="button"
            >
              {titleCase(item)}
            </button>
          ))}
        </nav>
        <div className="account-actions">
          {children && children.length > 0 ? (
            <select
              aria-label="Linked child"
              onChange={(event) => setSelectedChildId(event.target.value)}
              value={selectedChildId ?? ''}
            >
              {children.map((child) => (
                <option key={child.id} value={child.id}>{child.displayName}</option>
              ))}
            </select>
          ) : null}
          <button className="avatar-button" onClick={() => setShowLinkForm(true)} type="button">
            <span aria-hidden="true">👨‍👩‍👧</span>
            <span>{guardian.displayName}</span>
          </button>
          <button className="quiet-button" onClick={() => void signOut()} type="button">Sign out</button>
        </div>
      </header>

      {error ? <ErrorNotice message={error} /> : null}
      {showLinkForm ? (
        <LinkChildPanel
          onClose={children && children.length > 0 ? () => setShowLinkForm(false) : undefined}
          onLinked={(child) => {
            setChildren((current) => [...(current ?? []), child]);
            setSelectedChildId(child.id);
            setShowLinkForm(false);
          }}
        />
      ) : null}

      <main className="portal-main">
        {children === undefined || loadingDashboard ? <PageLoader /> : null}
        {children?.length === 0 && !showLinkForm ? (
          <EmptyChildren onLink={() => setShowLinkForm(true)} />
        ) : null}
        {selectedChild && !loadingDashboard ? (
          page === 'portfolio' ? (
            <PortfolioPage child={selectedChild} projects={dashboard.projects} />
          ) : page === 'activity' ? (
            <ActivityPage
              activities={dashboard.activities}
              child={selectedChild}
              projects={dashboard.projects}
            />
          ) : (
            <InsightsPage child={selectedChild} projects={dashboard.projects} />
          )
        ) : null}
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="brand" aria-label="ImagineLab">
      <span>ImagineLab</span><i aria-hidden="true">✦</i>
    </div>
  );
}

function LinkChildPanel({
  onClose,
  onLinked,
}: {
  onClose?: () => void;
  onLinked: (child: LinkedChild) => void;
}) {
  const [childId, setChildId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      onLinked(await parentApi.linkChild(childId.trim().toUpperCase()));
    } catch (linkError) {
      setError(messageFrom(linkError));
    } finally {
      setSubmitting(false);
    }
  }, [childId, onLinked]);

  return (
    <section className="link-panel" aria-labelledby="link-title">
      <div>
        <p className="eyebrow">CONNECT A CHILD</p>
        <h2 id="link-title">Enter the Child ID shown in the ImagineLab app.</h2>
        <p>The ID looks like KID-ABCD-2345. It is not the child&apos;s private login token.</p>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="child-id">Child ID</label>
        <div className="inline-form">
          <input
            id="child-id"
            onChange={(event) => setChildId(event.target.value)}
            pattern="KID-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}"
            placeholder="KID-ABCD-2345"
            required
            value={childId}
          />
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? 'Connecting…' : 'Connect'}
          </button>
          {onClose ? <button className="quiet-button" onClick={onClose} type="button">Cancel</button> : null}
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>
    </section>
  );
}

function PortfolioPage({ child, projects }: { child: LinkedChild; projects: GameProject[] }) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  return (
    <div className={`portfolio-layout ${selectedProject ? 'drawer-open' : ''}`}>
      <section className="page-content">
        <PageHeading
          eyebrow="PORTFOLIO"
          title={`${possessive(child.displayName)} worlds`}
          description={`Games and stories ${child.displayName} creates in ImagineLab.`}
        />
        {projects.length === 0 ? (
          <EmptyCard title="A blank lab is full of possibilities." copy="New games will appear here." />
        ) : (
          <div className="project-grid">
            {projects.map((project, index) => (
              <ProjectCard
                index={index}
                key={project.id}
                onOpen={() => setSelectedProjectId(project.id)}
                project={project}
              />
            ))}
          </div>
        )}
      </section>
      {selectedProject ? (
        <ProjectDrawer onClose={() => setSelectedProjectId(null)} project={selectedProject} />
      ) : null}
    </div>
  );
}

function ProjectCard({
  index,
  onOpen,
  project,
}: {
  index: number;
  onOpen: () => void;
  project: GameProject;
}) {
  return (
    <article className="project-card">
      <button className={`project-art art-${(index % 4) + 1}`} onClick={onOpen} type="button">
        <span aria-hidden="true">{['🐒', '🐧', '🌈', '⚽'][index % 4]}</span>
        <strong>{project.title}</strong>
      </button>
      <div className="project-meta">
        <span className={`status ${project.status}`}>{titleCase(project.status)}</span>
        <span>v{project.currentVersion.versionNumber}</span>
        <time dateTime={project.updatedAt}>{formatDate(project.updatedAt)}</time>
      </div>
    </article>
  );
}

function ProjectDrawer({ onClose, project }: { onClose: () => void; project: GameProject }) {
  const [previewVersionId, setPreviewVersionId] = useState(project.currentVersion.id);
  const previewVersion =
    project.versions.find((version) => version.id === previewVersionId) ?? project.currentVersion;

  return (
    <aside className="project-drawer" aria-label={`${project.title} project details`}>
      <div className="drawer-title">
        <h2>{project.title}</h2>
        <button aria-label="Close project details" onClick={onClose} type="button">×</button>
      </div>
      <div className="preview-frame">
        <iframe
          referrerPolicy="no-referrer"
          sandbox="allow-scripts"
          srcDoc={previewVersion.html}
          title={`${project.title} version ${previewVersion.versionNumber} playable preview`}
        />
      </div>
      <div className="drawer-actions">
        {project.publicSlug ? (
          <a className="primary-button" href={publicGameUrl(project.publicSlug)} target="_blank" rel="noreferrer">Open game</a>
        ) : (
          <span className="status draft">Draft preview</span>
        )}
        <span>Latest version: {project.currentVersion.versionNumber}</span>
      </div>
      <section className="version-history">
        <div>
          <p className="eyebrow">IMMUTABLE VERSIONS</p>
          <h3>Version history</h3>
        </div>
        <div className="version-list">
          {[...project.versions].reverse().map((version) => (
            <button
              aria-pressed={previewVersion.id === version.id}
              className="version-chip"
              key={version.id}
              onClick={() => setPreviewVersionId(version.id)}
              type="button"
            >
              <strong>Version {version.versionNumber}</strong>
              <time dateTime={version.createdAt}>{formatDate(version.createdAt)}</time>
            </button>
          ))}
        </div>
      </section>
      <section className="learning-snapshot">
        <p className="eyebrow">PROJECT LEARNING SNAPSHOT</p>
        <h3>Request for version {previewVersion.versionNumber}</h3>
        <blockquote>“{previewVersion.prompt}”</blockquote>
        <p>Evidence from this project only. Open Insights for the six creative-practice signals.</p>
      </section>
    </aside>
  );
}

function ActivityPage({
  activities,
  child,
  projects,
}: {
  activities: ActivityEvent[];
  child: LinkedChild;
  projects: GameProject[];
}) {
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  return (
    <section className="page-content narrow-page">
      <PageHeading
        eyebrow="ACTIVITY"
        title={`${possessive(child.displayName)} creative trail`}
        description="Meaningful creation milestones, shown chronologically — not screen-time tracking."
      />
      {activities.length === 0 ? (
        <EmptyCard title="No activity yet." copy="Create, edit, playtest, and publishing events will appear here." />
      ) : (
        <div className="timeline">
          {activities.map((activity) => {
            const project = projectById.get(activity.projectId);
            return (
              <article className="timeline-event" key={activity.id}>
                <span className={`event-icon event-${activity.type}`} aria-hidden="true">
                  {activityIcon(activity.type)}
                </span>
                <div>
                  <time dateTime={activity.createdAt}>{formatDateTime(activity.createdAt)}</time>
                  <h2>{activityLabel(activity.type)}</h2>
                  <p>{project?.title ?? 'ImagineLab project'}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function InsightsPage({ child, projects }: { child: LinkedChild; projects: GameProject[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const selectedProject = projects.find((project) => project.id === projectId) ?? projects[0] ?? null;
  const [insight, setInsight] = useState<ProjectInsight | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!selectedProject) {
      setInsight(null);
      return;
    }
    let active = true;
    setInsight(undefined);
    setError(null);
    void parentApi
      .loadInsight(child.id, selectedProject.id)
      .then((result) => {
        if (active) setInsight(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(messageFrom(loadError));
      });
    return () => {
      active = false;
    };
  }, [child.id, selectedProject]);

  const generate = useCallback(async () => {
    if (!selectedProject) return;
    setGenerating(true);
    setError(null);
    try {
      setInsight(await parentApi.generateInsight(child.id, selectedProject.id));
    } catch (generationError) {
      setError(messageFrom(generationError));
    } finally {
      setGenerating(false);
    }
  }, [child.id, selectedProject]);

  return (
    <section className="page-content insights-page">
      <PageHeading
        eyebrow="CREATIVE INSIGHTS"
        title={`How ${child.displayName} approaches making games`}
        description="Evidence observed in selected projects — never a grade, ranking, or fixed ability score."
      />
      {projects.length > 0 ? (
        <label className="project-picker">
          Project evidence
          <select onChange={(event) => setProjectId(event.target.value)} value={selectedProject?.id ?? ''}>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
        </label>
      ) : null}
      {error ? <ErrorNotice message={error} /> : null}
      {insight === undefined ? <PageLoader /> : insight ? (
        <InsightDashboard insight={insight} project={selectedProject!} />
      ) : selectedProject ? (
        <div className="generate-insight">
          <span aria-hidden="true">✦</span>
          <h2>Build the first evidence snapshot.</h2>
          <p>ImagineLab will read this project&apos;s prompts and immutable versions.</p>
          <button className="primary-button" disabled={generating} onClick={() => void generate()} type="button">
            {generating ? 'Reading the project…' : 'Generate project insight'}
          </button>
        </div>
      ) : (
        <EmptyCard title="No project evidence yet." copy="Insights begin after the first game is created." />
      )}
    </section>
  );
}

function InsightDashboard({ insight, project }: { insight: ProjectInsight; project: GameProject }) {
  const [selectedKey, setSelectedKey] = useState<CreativeDimensionKey>('imagination');
  const selected = insight.radar.dimensions.find((dimension) => dimension.key === selectedKey)!;
  return (
    <div className="insight-dashboard">
      <section className="radar-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">CREATIVE PRACTICE RADAR</p>
            <h2>{project.title}</h2>
          </div>
          <span className="evidence-key">0–4 evidence states</span>
        </div>
        <RadarChart dimensions={insight.radar.dimensions} />
        <div className="dimension-controls" aria-label="Creative-practice dimensions">
          {insight.radar.dimensions.map((dimension) => (
            <button
              aria-pressed={selectedKey === dimension.key}
              key={dimension.key}
              onClick={() => setSelectedKey(dimension.key)}
              type="button"
            >
              {dimensionLabel(dimension.key)} — {dimension.label}
            </button>
          ))}
        </div>
      </section>
      <aside className="evidence-card" aria-live="polite">
        <p className="eyebrow">SELECTED EVIDENCE</p>
        <h2>{dimensionLabel(selected.key)} evidence</h2>
        <span className={`level-badge level-${selected.level}`}>{selected.label}</span>
        <p>{selected.observation}</p>
        <ul>{selected.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
      </aside>
      <section className="summary-module">
        <p className="eyebrow">PROJECT SUMMARY</p>
        <p>{insight.summary}</p>
      </section>
      <section className="questions-module">
        <p className="eyebrow">TALK ABOUT IT TOGETHER</p>
        <ol>{insight.conversationStarters.map((question) => <li key={question}>{question}</li>)}</ol>
      </section>
      <p className="insight-disclaimer">{insight.disclaimer}</p>
    </div>
  );
}

function RadarChart({ dimensions }: { dimensions: readonly CreativeDimensionValue[] }) {
  const center = 160;
  const radius = 105;
  const gridLevels = [1, 2, 3, 4];
  const point = (index: number, scale: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 6;
    return [center + Math.cos(angle) * radius * scale, center + Math.sin(angle) * radius * scale];
  };
  const polygon = (scales: readonly number[]) =>
    scales.map((scale, index) => point(index, scale).map((value) => value.toFixed(2)).join(',')).join(' ');

  return (
    <svg
      aria-labelledby="radar-title radar-description"
      className="radar-chart"
      role="img"
      viewBox="0 0 320 320"
    >
      <title id="radar-title">Creative practice radar for this project</title>
      <desc id="radar-description">
        Six evidence levels from zero to four. Higher positions mean more supporting project evidence,
        not greater ability.
      </desc>
      {gridLevels.map((level) => (
        <polygon className="radar-grid" key={level} points={polygon(Array(6).fill(level / 4))} />
      ))}
      {dimensions.map((dimension, index) => {
        const [x, y] = point(index, 1);
        return <line className="radar-axis" key={dimension.key} x1={center} x2={x} y1={center} y2={y} />;
      })}
      <polygon
        className="radar-value"
        points={polygon(dimensions.map((dimension) => dimension.level / 4))}
      />
      {dimensions.map((dimension, index) => {
        const [x, y] = point(index, Math.max(dimension.level / 4, 0.04));
        return <circle className="radar-point" cx={x} cy={y} key={dimension.key} r="4" />;
      })}
      {dimensions.map((dimension, index) => {
        const [x, y] = point(index, 1.26);
        return (
          <text className="radar-label" key={dimension.key} textAnchor="middle" x={x} y={y}>
            {dimensionLabel(dimension.key)}
          </text>
        );
      })}
    </svg>
  );
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function EmptyChildren({ onLink }: { onLink: () => void }) {
  return (
    <section className="empty-children">
      <span aria-hidden="true">✦</span>
      <h1>Connect your first child.</h1>
      <p>Ask them to open their ImagineLab account card and share the Child ID.</p>
      <button className="primary-button" onClick={onLink} type="button">Enter Child ID</button>
    </section>
  );
}

function EmptyCard({ title, copy }: { title: string; copy: string }) {
  return <div className="empty-card"><span aria-hidden="true">☄️</span><h2>{title}</h2><p>{copy}</p></div>;
}

function PageLoader() {
  return <div className="page-loader" aria-live="polite"><span aria-hidden="true">✦</span> Loading…</div>;
}

function ErrorNotice({ message }: { message: string }) {
  return <div className="error-notice" role="alert">{message}</div>;
}

function dimensionLabel(key: CreativeDimensionKey): string {
  return {
    imagination: 'Imagination',
    expression: 'Expression',
    game_design: 'Game Design',
    experimentation: 'Experimentation',
    iteration: 'Iteration',
    reflection: 'Reflection',
  }[key];
}

function activityLabel(type: ActivityEvent['type']): string {
  return {
    create: 'Created a new game',
    edit: 'Improved a game version',
    playtest: 'Recorded a playtest',
    reflection: 'Added a reflection',
    publish: 'Published a game',
    unpublish: 'Returned a game to draft',
    insight_generated: 'Generated a project insight',
  }[type];
}

function activityIcon(type: ActivityEvent['type']): string {
  return { create: '✎', edit: '✦', playtest: '★', reflection: '♡', publish: '↗', unpublish: '↙', insight_generated: '◇' }[type];
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Something unexpected happened.';
}

export default App;
