import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, backendAssetUrl, parentApi, publicGameUrl } from './api';
import type {
  ActivityEvent,
  ChildInsight,
  CreativeDimensionKey,
  CreativeDimensionValue,
  GameProject,
  GuardianDashboard,
  GuardianUser,
  LinkedChild,
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
  const [childMenuOpen, setChildMenuOpen] = useState(false);

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
      if (linkedChildren.length === 0) setChildMenuOpen(true);
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
          <ChildSwitcher
            linkedChildren={children ?? []}
            onLinked={(child) => {
              setChildren((current) => [...(current ?? []), child]);
              setSelectedChildId(child.id);
              setChildMenuOpen(false);
            }}
            onOpenChange={setChildMenuOpen}
            onSelect={(childId) => {
              setSelectedChildId(childId);
              setChildMenuOpen(false);
            }}
            open={childMenuOpen}
            selectedChild={selectedChild}
          />
          <button
            aria-label={`Sign out ${guardian.displayName}`}
            className="quiet-button sign-out-button"
            onClick={() => void signOut()}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>

      {error ? <ErrorNotice message={error} /> : null}

      <main className="portal-main">
        {children === undefined || loadingDashboard ? <PageLoader /> : null}
        {children?.length === 0 ? (
          <EmptyChildren onLink={() => setChildMenuOpen(true)} />
        ) : null}
        {selectedChild && !loadingDashboard ? (
          page === 'portfolio' ? (
            <PortfolioPage child={selectedChild} key={selectedChild.id} projects={dashboard.projects} />
          ) : page === 'activity' ? (
            <ActivityPage
              activities={dashboard.activities}
              child={selectedChild}
              key={selectedChild.id}
              projects={dashboard.projects}
            />
          ) : (
            <InsightsPage child={selectedChild} key={selectedChild.id} projects={dashboard.projects} />
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

function ChildSwitcher({
  linkedChildren,
  onLinked,
  onOpenChange,
  onSelect,
  open,
  selectedChild,
}: {
  linkedChildren: LinkedChild[];
  onLinked: (child: LinkedChild) => void;
  onOpenChange: (open: boolean) => void;
  onSelect: (childId: string) => void;
  open: boolean;
  selectedChild: LinkedChild | null;
}) {
  const currentName = selectedChild?.displayName ?? 'No child selected';

  return (
    <div className="child-switcher">
      <button
        aria-controls="child-switcher-popover"
        aria-expanded={open}
        aria-label={`Switch or connect child. Current child: ${currentName}`}
        className="child-switcher-trigger"
        onClick={() => onOpenChange(!open)}
        type="button"
      >
        <span className="child-avatar" aria-hidden="true">
          {selectedChild ? selectedChild.displayName.charAt(0).toUpperCase() : '+'}
        </span>
        <span className="child-trigger-copy">
          <small>{selectedChild ? 'Viewing' : 'Parent portal'}</small>
          <strong>{selectedChild?.displayName ?? 'Connect a child'}</strong>
        </span>
        <svg aria-hidden="true" className="child-trigger-chevron" viewBox="0 0 20 20">
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>

      {open ? (
        <div
          className="child-switcher-popover"
          id="child-switcher-popover"
          onKeyDown={(event) => {
            if (event.key === 'Escape') onOpenChange(false);
          }}
        >
          {linkedChildren.length > 0 ? (
            <section className="linked-children" aria-labelledby="switch-child-title">
              <div className="popover-heading-row">
                <div>
                  <p className="eyebrow">YOUR CHILDREN</p>
                  <h2 id="switch-child-title">Switch child</h2>
                </div>
                <span>{linkedChildren.length} connected</span>
              </div>
              <div className="linked-child-options">
                {linkedChildren.map((child) => {
                  const selected = child.id === selectedChild?.id;
                  return (
                    <button
                      aria-label={`Switch to ${child.displayName}`}
                      aria-pressed={selected}
                      className="linked-child-option"
                      key={child.id}
                      onClick={() => onSelect(child.id)}
                      type="button"
                    >
                      <span className="linked-child-avatar" aria-hidden="true">
                        {child.displayName.charAt(0).toUpperCase()}
                      </span>
                      <span>
                        <strong>{child.displayName}</strong>
                        <small>{child.childId}</small>
                      </span>
                      <span className="child-option-state">{selected ? 'Viewing' : 'View'}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <div className="no-linked-children">
              <span aria-hidden="true">✦</span>
              <strong>Connect your first child</strong>
              <p>Their ImagineLab projects will appear here.</p>
            </div>
          )}

          <LinkChildPanel onClose={() => onOpenChange(false)} onLinked={onLinked} />
        </div>
      ) : null}
    </div>
  );
}

function LinkChildPanel({
  onClose,
  onLinked,
}: {
  onClose: () => void;
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
    <section className="link-child-form" aria-labelledby="link-title">
      <p className="eyebrow">CONNECT A CHILD</p>
      <h3 id="link-title">Enter the Child ID shown in the ImagineLab app.</h3>
      <p className="link-child-help">
        The ID looks like KID-ABCD-2345. It is not the child&apos;s private login token.
      </p>
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="child-id">Child ID</label>
        <input
          autoCapitalize="characters"
          autoComplete="off"
          id="child-id"
          onChange={(event) => setChildId(event.target.value.toUpperCase())}
          pattern="KID-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}"
          placeholder="KID-ABCD-2345"
          required
          value={childId}
        />
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="link-child-actions">
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? 'Connecting…' : 'Connect'}
          </button>
          <button className="quiet-button" onClick={onClose} type="button">Cancel</button>
        </div>
      </form>
    </section>
  );
}

function PortfolioPage({ child, projects }: { child: LinkedChild; projects: GameProject[] }) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projects[0]?.id ?? null,
  );
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
                selected={selectedProject?.id === project.id}
              />
            ))}
          </div>
        )}
      </section>
      {selectedProject ? (
        <ProjectDrawer childName={child.displayName} onClose={() => setSelectedProjectId(null)} project={selectedProject} />
      ) : null}
    </div>
  );
}

function ProjectCard({
  index,
  onOpen,
  project,
  selected,
}: {
  index: number;
  onOpen: () => void;
  project: GameProject;
  selected: boolean;
}) {
  return (
    <article className={`project-card ${selected ? 'selected' : ''}`}>
      <button className={`project-art art-${(index % 4) + 1}`} onClick={onOpen} type="button">
        <ProjectArtwork index={index} project={project} />
        <strong>{project.title}</strong>
        {selected ? <span className="selected-check" aria-hidden="true">✓</span> : null}
      </button>
      <div className="project-meta">
        <span className={`status ${project.status}`}>{titleCase(project.status)}</span>
        <span>v{project.currentVersion.versionNumber}</span>
        <time dateTime={project.updatedAt}>Updated {formatShortDate(project.updatedAt)}</time>
        <span className="project-more" aria-hidden="true">⋮</span>
      </div>
    </article>
  );
}

function ProjectDrawer({ childName, onClose, project }: { childName: string; onClose: () => void; project: GameProject }) {
  const [previewVersionId, setPreviewVersionId] = useState(project.currentVersion.id);
  const [playing, setPlaying] = useState(false);
  const previewVersion =
    project.versions.find((version) => version.id === previewVersionId) ?? project.currentVersion;
  const firstVersion = project.versions[0] ?? project.currentVersion;
  const canvasAssets = project.builder?.assets.map((asset) => asset.name).filter(Boolean) ?? [];

  return (
    <aside className="project-drawer" aria-label={`${project.title} project details`}>
      <div className="drawer-title">
        <h2>{project.title}</h2>
        <button aria-label="Close project details" onClick={onClose} type="button">×</button>
      </div>
      <div className="preview-frame">
        {playing ? (
          <iframe
            referrerPolicy="no-referrer"
            sandbox="allow-scripts"
            srcDoc={previewVersion.html}
            title={`${project.title} version ${previewVersion.versionNumber} playable preview`}
          />
        ) : (
          <>
            <ProjectArtwork index={1} project={project} />
            <button
              aria-label={`Play ${project.title} preview`}
              className="preview-play"
              onClick={() => setPlaying(true)}
              type="button"
            >
              ▶
            </button>
          </>
        )}
      </div>
      <div className="drawer-actions">
        {project.publicSlug ? (
          <a className="primary-button drawer-primary" href={publicGameUrl(project.publicSlug)} target="_blank" rel="noreferrer">Open game ↗</a>
        ) : (
          <button className="primary-button drawer-primary" onClick={() => setPlaying(true)} type="button">Open preview</button>
        )}
        <span className="versions-label">◷&nbsp; Versions</span>
      </div>
      <section className="version-history">
        <h3>Versions</h3>
        <div className="version-list">
          {[...project.versions].reverse().map((version) => (
            <button
              aria-label={`Version ${version.versionNumber}`}
              aria-pressed={previewVersion.id === version.id}
              className="version-chip"
              key={version.id}
              onClick={() => setPreviewVersionId(version.id)}
              type="button"
            >
              <span className={`version-art art-${(version.versionNumber % 4) + 1}`}>
                <ProjectArtwork index={version.versionNumber} project={project} />
              </span>
              <strong>{version.id === project.currentVersion.id ? 'Latest' : formatShortDate(version.createdAt)}</strong>
            </button>
          ))}
        </div>
      </section>
      <section className="project-story">
        <h3><span aria-hidden="true">▣</span> Project story</h3>
        <dl>
          <div>
            <dt><span aria-hidden="true">♧</span> Original idea</dt>
            <dd>{firstVersion.prompt}</dd>
          </div>
          <div>
            <dt><span aria-hidden="true">◉</span> Child-created canvas</dt>
            <dd>{canvasAssets.length > 0 ? canvasAssets.join(', ') : 'No saved canvas details for this project.'}</dd>
          </div>
          <div>
            <dt><span aria-hidden="true">✎</span> What changed</dt>
            <dd>{project.versions.length > 1 ? `${project.versions.length - 1} later request${project.versions.length === 2 ? '' : 's'} shaped the current game.` : 'This is the first saved version.'}</dd>
          </div>
          <div>
            <dt><span aria-hidden="true">▱</span> Latest request</dt>
            <dd>{previewVersion.prompt}</dd>
          </div>
          <div className="ask-child-row">
            <dt><span aria-hidden="true">?</span> Ask {childName}</dt>
            <dd>Which part of this world did you imagine first? <b aria-hidden="true">→</b></dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}

function ProjectArtwork({ index, project }: { index: number; project: GameProject }) {
  const imageUrl = project.profileImageUrl ? backendAssetUrl(project.profileImageUrl) : null;
  return (
    <span className="project-artwork" aria-hidden="true">
      {imageUrl ? (
        <img
          alt=""
          onError={(event) => { event.currentTarget.hidden = true; }}
          src={imageUrl}
        />
      ) : null}
      <span className="art-fallback">{['🐒', '🐧', '🌈', '⚽'][index % 4]}</span>
    </span>
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
  const [projectFilter, setProjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(activities[0]?.id ?? null);
  const filteredActivities = useMemo(
    () => activities.filter((activity) =>
      (projectFilter === 'all' || activity.projectId === projectFilter) &&
      (typeFilter === 'all' || activity.type === typeFilter)),
    [activities, projectFilter, typeFilter],
  );
  const selectedActivity =
    filteredActivities.find((activity) => activity.id === selectedActivityId) ??
    filteredActivities[0] ??
    null;
  const groups = useMemo(() => groupActivities(filteredActivities), [filteredActivities]);

  return (
    <div className={`activity-layout ${selectedActivity ? 'drawer-open' : ''}`}>
      <section className="page-content activity-page">
        <div className="activity-heading-row">
          <PageHeading
            eyebrow="ACTIVITY"
            title={`${possessive(child.displayName)} activity`}
            description={`A factual timeline of ${possessive(child.displayName)} creation milestones.`}
          />
          <div className="activity-filters" aria-label="Activity filters">
            <label>
              <span aria-hidden="true">▣</span>
              <select aria-label="Filter by project" onChange={(event) => setProjectFilter(event.target.value)} value={projectFilter}>
                <option value="all">All projects</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
            </label>
            <label>
              <span aria-hidden="true">▽</span>
              <select aria-label="Filter by activity type" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
                <option value="all">All activity</option>
                {Array.from(new Set(activities.map((activity) => activity.type))).map((type) => (
                  <option key={type} value={type}>{activityLabel(type)}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {filteredActivities.length === 0 ? (
          <EmptyCard title="No matching activity." copy="Try another filter, or return after a new creation milestone." />
        ) : (
          <div className="activity-groups">
            {groups.map((group) => (
              <section className="activity-group" key={group.label}>
                <h2>{group.label}</h2>
                <div className="timeline">
                  {group.activities.map((activity) => {
                    const project = projectById.get(activity.projectId);
                    const projectIndex = Math.max(0, projects.findIndex((candidate) => candidate.id === project?.id));
                    const selected = activity.id === selectedActivity?.id;
                    return (
                      <article className={`timeline-event ${selected ? 'selected' : ''}`} key={activity.id}>
                        <button
                          aria-label={`View ${activityLabel(activity.type)} details`}
                          onClick={() => setSelectedActivityId(activity.id)}
                          type="button"
                        >
                          <time dateTime={activity.createdAt}>{formatActivityTime(activity.createdAt)}</time>
                          <span className={`event-icon event-${activity.type}`} aria-hidden="true">
                            {activityIcon(activity.type)}
                          </span>
                          <span className={`activity-thumbnail art-${(projectIndex % 4) + 1}`}>
                            {project ? <ProjectArtwork index={projectIndex} project={project} /> : null}
                          </span>
                          <span className="event-copy">
                            <strong>{activityLabel(activity.type)} <em>{project?.title ?? 'ImagineLab project'}</em></strong>
                            <small>{activityDescription(activity, project)}</small>
                          </span>
                          {selected ? <span className="event-arrow" aria-hidden="true">›</span> : null}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
      {selectedActivity ? (
        <ActivityDrawer
          activity={selectedActivity}
          child={child}
          onClose={() => setSelectedActivityId(null)}
          project={projectById.get(selectedActivity.projectId) ?? null}
          projectIndex={Math.max(0, projects.findIndex((project) => project.id === selectedActivity.projectId))}
        />
      ) : null}
    </div>
  );
}

function ActivityDrawer({
  activity,
  child,
  onClose,
  project,
  projectIndex,
}: {
  activity: ActivityEvent;
  child: LinkedChild;
  onClose: () => void;
  project: GameProject | null;
  projectIndex: number;
}) {
  const metadataEntries = Object.entries(activity.metadata).filter(([, value]) => value !== null);
  return (
    <aside className="activity-drawer" aria-label="Selected activity details">
      <div className="drawer-title">
        <div>
          <h2>{activityDetailTitle(activity, project)}</h2>
          <p><time dateTime={activity.createdAt}>{formatDateTime(activity.createdAt)}</time> · <b>{project?.title ?? 'ImagineLab project'}</b></p>
        </div>
        <button aria-label="Close activity details" onClick={onClose} type="button">×</button>
      </div>
      {project ? (
        <div className={`activity-detail-art art-${(projectIndex % 4) + 1}`}>
          <ProjectArtwork index={projectIndex} project={project} />
        </div>
      ) : null}
      <section className="activity-detail-section">
        <h3><span aria-hidden="true">◯</span> What was recorded</h3>
        <p>{activityDescription(activity, project)}</p>
      </section>
      {metadataEntries.length > 0 ? (
        <section className="activity-detail-section">
          <h3><span aria-hidden="true">◇</span> Event details</h3>
          <dl className="metadata-list">
            {metadataEntries.map(([key, value]) => (
              <div key={key}><dt>{titleCase(key.replaceAll('_', ' '))}</dt><dd>{String(value)}</dd></div>
            ))}
          </dl>
        </section>
      ) : null}
      {project?.publicSlug ? (
        <a className="activity-game-link" href={publicGameUrl(project.publicSlug)} rel="noreferrer" target="_blank">↗&nbsp; View published game</a>
      ) : null}
      <section className="activity-detail-section reflection-note">
        <h3><span aria-hidden="true">☆</span> Conversation starter</h3>
        <p>Ask {child.displayName}: “What did you notice while making this change?”</p>
      </section>
      <p className="recorded-note">ⓘ This event comes from {possessive(child.displayName)} saved project history.</p>
    </aside>
  );
}

function InsightsPage({ child, projects }: { child: LinkedChild; projects: GameProject[] }) {
  const [insight, setInsight] = useState<ChildInsight | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let active = true;
    setInsight(undefined);
    setError(null);
    void parentApi
      .loadInsight(child.id)
      .then((result) => {
        if (active) setInsight(result);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setInsight(null);
          setError(messageFrom(loadError));
        }
      });
    return () => {
      active = false;
    };
  }, [child.id]);

  const generate = useCallback(async () => {
    if (projects.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      setInsight(await parentApi.generateInsight(child.id));
    } catch (generationError) {
      setError(messageFrom(generationError));
    } finally {
      setGenerating(false);
    }
  }, [child.id, projects.length]);

  const versionCount = projects.reduce((total, project) => total + project.versions.length, 0);

  return (
    <section className="page-content insights-page">
      <header className="insights-heading">
        <div>
          <p className="eyebrow">CREATIVE INSIGHTS</p>
          <h1>{possessive(child.displayName)} creative landscape</h1>
          <p>Evidence from {projects.length} project{projects.length === 1 ? '' : 's'} · {versionCount} version{versionCount === 1 ? '' : 's'} · Portfolio snapshot</p>
        </div>
        {insight ? (
          <button className="refresh-insight-button" disabled={generating} onClick={() => void generate()} type="button">
            ↻&nbsp; {generating ? 'Refreshing…' : 'Refresh insight'}
          </button>
        ) : null}
      </header>
      <p className="insight-safety-note">ⓘ&nbsp; Portfolio-based observations — not an educational or psychological assessment.</p>
      {error ? <ErrorNotice message={error} /> : null}
      {insight === undefined ? <PageLoader /> : insight ? (
        <InsightDashboard
          child={child}
          insight={insight}
          onRefresh={() => void generate()}
          projects={projects}
          refreshing={generating}
        />
      ) : projects.length > 0 ? (
        <div className="generate-insight">
          <span aria-hidden="true">✦</span>
          <h2>Build {child.displayName}&apos;s first portfolio snapshot.</h2>
          <p>ImagineLab will read all {projects.length} project{projects.length === 1 ? '' : 's'} and their immutable versions.</p>
          <button className="primary-button" disabled={generating} onClick={() => void generate()} type="button">
            {generating ? 'Reading the portfolio…' : 'Generate child insight'}
          </button>
        </div>
      ) : (
        <EmptyCard title="No project evidence yet." copy="Insights begin after the first game is created." />
      )}
    </section>
  );
}

function InsightDashboard({
  child,
  insight,
  onRefresh,
  projects,
  refreshing,
}: {
  child: LinkedChild;
  insight: ChildInsight;
  onRefresh: () => void;
  projects: GameProject[];
  refreshing: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState<CreativeDimensionKey>('imagination');
  const selected = insight.radar.dimensions.find((dimension) => dimension.key === selectedKey)!;
  const projectCount = insight.sourceProjectIds.length;
  const sourceProjects = insight.sourceProjectIds
    .map((id) => projects.find((project) => project.id === id))
    .filter((project): project is GameProject => Boolean(project));
  return (
    <div className="insight-dashboard">
      <section className="hexagon-card">
        <div className="hexagon-heading">
          <h2>Creative Practice Hexagon</h2>
          <p>Select a dimension to see supporting evidence.</p>
        </div>
        <CreativePracticeHexagon dimensions={insight.radar.dimensions} selectedKey={selectedKey} />
        <div className="dimension-controls hexagon-legend" aria-label="Creative-practice dimensions">
          {insight.radar.dimensions.map((dimension) => (
            <button
              aria-label={`${dimensionLabel(dimension.key)} — ${dimension.label}`}
              aria-pressed={selectedKey === dimension.key}
              className={`dimension-${dimension.key}`}
              key={dimension.key}
              onClick={() => setSelectedKey(dimension.key)}
              type="button"
            >
              <span aria-hidden="true">{dimensionSymbol(dimension.key)}</span>
              <span>{dimensionLabel(dimension.key)}<small>{dimension.label}</small></span>
            </button>
          ))}
        </div>
        <div className="evidence-scale" aria-label={`${projectCount} project${projectCount === 1 ? '' : 's'} and zero to four evidence states`}>
          <span><i className="scale-solid" /> Repeated evidence</span>
          <span><i className="scale-ring" /> First signal</span>
          <span><i className="scale-muted" /> Not enough evidence</span>
        </div>
      </section>
      <aside className="evidence-card" aria-live="polite">
        <header className="selected-dimension-heading">
          <span className={`dimension-mark dimension-${selected.key}`} aria-hidden="true">{dimensionSymbol(selected.key)}</span>
          <div>
            <h2>{dimensionLabel(selected.key)}</h2>
            <p>{selected.label} across the available portfolio</p>
          </div>
          <span className={`level-badge level-${selected.level}`}>↻&nbsp; {selected.label}</span>
        </header>
        <section className="observation-copy">
          <h3>What we observed</h3>
          <p>{selected.observation}</p>
        </section>
        <section className="project-evidence-list">
          <h3>Evidence from projects</h3>
          {selected.evidence.map((item, index) => {
            const project = sourceProjects[index % Math.max(1, sourceProjects.length)];
            return (
              <article key={`${item}-${index}`}>
                {project ? <span className={`evidence-thumb art-${(index % 4) + 1}`}><ProjectArtwork index={index} project={project} /></span> : null}
                <span><strong>{item}</strong>{project ? <small>{project.title} · {formatShortDate(project.updatedAt)}</small> : null}</span>
              </article>
            );
          })}
        </section>
        <div className="evidence-conversation-row">
          <section>
            <h3>❝&nbsp; Portfolio evidence</h3>
            <p>“{selected.evidence[0] ?? selected.observation}”</p>
          </section>
          <section>
            <h3>●&nbsp; Talk with {child.displayName}</h3>
            <p>{insight.conversationStarters[0] ?? 'What would you like to try next?'} <b aria-hidden="true">→</b></p>
          </section>
        </div>
      </aside>
      <section className="summary-module">
        <h2><span aria-hidden="true">▱</span> Portfolio summary</h2>
        <p>{insight.summary}</p>
      </section>
      <section className="interests-module">
        <h2><span aria-hidden="true">♡</span> Possible interests</h2>
        <div className="interest-chips">{insight.interests.slice(0, 5).map((interest, index) => <span key={interest}><b aria-hidden="true">{['◉', '♞', '☺', '♫', '✦'][index]}</b>{interest}</span>)}</div>
        <p>Themes that appear in the available project evidence.</p>
      </section>
      <section className="concepts-module">
        <h2><span aria-hidden="true">‹/›</span> Creative practices</h2>
        <div className="concept-chips">{insight.radar.dimensions.filter((dimension) => dimension.level > 0).slice(0, 5).map((dimension) => <span key={dimension.key}><b aria-hidden="true">{dimensionSymbol(dimension.key)}</b>{dimensionLabel(dimension.key)}</span>)}</div>
        <p>Practices supported by the current portfolio evidence.</p>
      </section>
      <p className="insight-disclaimer">{insight.disclaimer} Generated {formatDateTime(insight.createdAt)}.</p>
      <button className="visually-hidden" disabled={refreshing} onClick={onRefresh} type="button">Refresh child insight</button>
    </div>
  );
}

function CreativePracticeHexagon({
  dimensions,
  selectedKey,
}: {
  dimensions: readonly CreativeDimensionValue[];
  selectedKey: CreativeDimensionKey;
}) {
  const center = 160;
  const radius = 102;
  const point = (index: number, scale: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 6;
    return [center + Math.cos(angle) * radius * scale, center + Math.sin(angle) * radius * scale];
  };
  const outer = dimensions.map((_dimension, index) => point(index, 1));

  return (
    <svg
      aria-labelledby="hexagon-title hexagon-description"
      className="creative-hexagon"
      role="img"
      viewBox="0 0 320 320"
    >
      <title id="hexagon-title">Creative practice radar hexagon across this child&apos;s portfolio</title>
      <desc id="hexagon-description">
        Six open evidence states. Filled sections indicate available supporting evidence, not ability.
      </desc>
      {dimensions.map((dimension, index) => {
        const nextIndex = (index + 1) % 6;
        const points = [[center, center], outer[index]!, outer[nextIndex]!]
          .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
          .join(' ');
        return <polygon className={`hex-segment dimension-${dimension.key} level-${dimension.level} ${selectedKey === dimension.key ? 'selected' : ''}`} key={dimension.key} points={points} />;
      })}
      {dimensions.map((dimension, index) => {
        const [x, y] = point(index + 0.5, 0.6);
        return (
          <text className="hex-symbol" key={dimension.key} textAnchor="middle" x={x} y={y + 7}>
            {dimensionSymbol(dimension.key)}
          </text>
        );
      })}
      <polygon className="hex-center" points="160,126 189,143 189,177 160,194 131,177 131,143" />
      <text className="hex-center-symbol" textAnchor="middle" x="160" y="172">☆</text>
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

function dimensionSymbol(key: CreativeDimensionKey): string {
  return {
    imagination: '☁',
    expression: '✎',
    game_design: '⌘',
    experimentation: '⚗',
    iteration: '↻',
    reflection: '☁',
  }[key];
}

function activityLabel(type: ActivityEvent['type']): string {
  return {
    create: 'Created',
    edit: 'Updated',
    playtest: 'Playtested',
    reflection: 'Reflected on',
    publish: 'Published',
    unpublish: 'Returned to draft',
    insight_generated: 'Generated insight for',
  }[type];
}

function activityIcon(type: ActivityEvent['type']): string {
  return { create: '+', edit: '✎', playtest: '▷', reflection: '☆', publish: '↥', unpublish: '↙', insight_generated: '◇' }[type];
}

function activityDescription(activity: ActivityEvent, project: GameProject | undefined | null): string {
  const versionNumber = activity.metadata.versionNumber;
  return {
    create: `Started ${project?.title ?? 'a game'} with an initial playable idea.`,
    edit: `Saved${typeof versionNumber === 'number' ? ` version ${versionNumber}` : ' a new version'} after a new request.`,
    playtest: `Tested${typeof versionNumber === 'number' ? ` version ${versionNumber}` : ' the latest version'} and saved a playtest milestone.`,
    reflection: 'Saved a child-authored reflection about the project.',
    publish: 'Made the game public so people with the link can play it.',
    unpublish: 'Removed the public link and returned the game to draft.',
    insight_generated: 'Created a new evidence snapshot from the saved project history.',
  }[activity.type];
}

function activityDetailTitle(activity: ActivityEvent, project: GameProject | null): string {
  const versionNumber = activity.metadata.versionNumber;
  if (activity.type === 'playtest' && typeof versionNumber === 'number') return `Playtested Version ${versionNumber}`;
  if (activity.type === 'edit' && typeof versionNumber === 'number') return `Updated Version ${versionNumber}`;
  return `${activityLabel(activity.type)} ${project?.title ?? 'project'}`;
}

function groupActivities(activities: ActivityEvent[]): Array<{ label: string; activities: ActivityEvent[] }> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups = new Map<string, ActivityEvent[]>();
  for (const activity of activities) {
    const timestamp = new Date(activity.createdAt).getTime();
    const daysAgo = Math.floor((todayStart - timestamp) / 86_400_000);
    const label = daysAgo <= 0 ? 'Today' : daysAgo <= 7 ? 'This week' : 'Earlier';
    const group = groups.get(label) ?? [];
    group.push(activity);
    groups.set(label, group);
  }
  return ['Today', 'This week', 'Earlier']
    .map((label) => ({ label, activities: groups.get(label) ?? [] }))
    .filter((group) => group.activities.length > 0);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatActivityTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  return sameDay
    ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date)
    : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Something unexpected happened.';
}

export default App;
