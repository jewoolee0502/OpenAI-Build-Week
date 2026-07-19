import { useCallback, useEffect, useMemo, useState } from 'react';

import { parentApi } from './api';
import type { ActivityEvent, GameProject, GuardianDashboard, ProjectInsight } from './types';
import './App.css';

function App() {
  const [dashboard, setDashboard] = useState<GuardianDashboard>({ projects: [], activities: [] });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setDashboard(await parentApi.loadDashboard());
    } catch (error) {
      setErrorMessage(messageFrom(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const selectedProject = useMemo(
    () => dashboard.projects.find((project) => project.id === selectedProjectId) ?? null,
    [dashboard.projects, selectedProjectId],
  );

  return (
    <div className="app-shell">
      <SiteHeader onHome={() => setSelectedProjectId(null)} />
      <main>
        {selectedProject ? (
          <ProjectDetail project={selectedProject} onBack={() => setSelectedProjectId(null)} />
        ) : (
          <Dashboard
            activities={dashboard.activities}
            errorMessage={errorMessage}
            isLoading={isLoading}
            onOpenProject={(project) => setSelectedProjectId(project.id)}
            onRetry={() => void loadDashboard()}
            projects={dashboard.projects}
          />
        )}
      </main>
      <footer className="site-footer">
        <span>ImagineLab Parent Portal</span>
        <span>Project observations, not an assessment.</span>
      </footer>
    </div>
  );
}

function SiteHeader({ onHome }: { onHome: () => void }) {
  return (
    <header className="site-header">
      <button className="brand-button" onClick={onHome} type="button">
        <span className="brand-mark" aria-hidden="true">✦</span>
        <span>ImagineLab</span>
      </button>
      <div className="portal-label">
        <span className="portal-dot" aria-hidden="true" />
        Parent portal
      </div>
    </header>
  );
}

interface DashboardProps {
  activities: ActivityEvent[];
  errorMessage: string | null;
  isLoading: boolean;
  onOpenProject: (project: GameProject) => void;
  onRetry: () => void;
  projects: GameProject[];
}

function Dashboard({
  activities,
  errorMessage,
  isLoading,
  onOpenProject,
  onRetry,
  projects,
}: DashboardProps) {
  const publishedCount = projects.filter((project) => project.status === 'published').length;
  const totalVersions = projects.reduce(
    (total, project) => total + project.currentVersion.versionNumber,
    0,
  );

  return (
    <div className="page-stack dashboard-page">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">ALEX'S CREATIVE LAB</p>
          <h1>See the thinking behind the play.</h1>
          <p className="hero-description">
            Follow each game from first idea to latest version, then turn the creative process into
            a better conversation.
          </p>
        </div>
        <div className="hero-stats" aria-label="Project summary">
          <Stat label="Projects" value={projects.length} />
          <Stat label="Versions" value={totalVersions} />
          <Stat label="Published" value={publishedCount} />
        </div>
      </section>

      {errorMessage ? (
        <ErrorNotice message={errorMessage} onRetry={onRetry} />
      ) : null}

      <section aria-labelledby="projects-title" className="section-block">
        <SectionHeader
          detail={projects.length === 1 ? '1 project' : `${projects.length} projects`}
          id="projects-title"
          title="Alex's projects"
        />
        {isLoading ? (
          <LoadingState label="Loading the creative lab…" />
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="project-grid">
            {projects.map((project, index) => (
              <ProjectCard
                index={index}
                key={project.id}
                onOpen={() => onOpenProject(project)}
                project={project}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="activity-title" className="activity-section">
        <SectionHeader detail="Create · Edit · Publish" id="activity-title" title="Recent activity" />
        {activities.length === 0 ? (
          <p className="muted-copy">Activity appears here as Alex builds and changes projects.</p>
        ) : (
          <div className="activity-list">
            {activities.slice(0, 8).map((activity) => (
              <ActivityRow activity={activity} key={activity.id} projects={projects} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-item">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SectionHeader({ detail, id, title }: { detail: string; id: string; title: string }) {
  return (
    <div className="section-header">
      <h2 id={id}>{title}</h2>
      <span>{detail}</span>
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
  const previewClass = `project-preview preview-${(index % 3) + 1}`;

  return (
    <article className="project-card">
      <button aria-label={`Open ${project.title}`} className={previewClass} onClick={onOpen} type="button">
        <span className="preview-orbit orbit-one" />
        <span className="preview-orbit orbit-two" />
        <span className="preview-spark">✦</span>
        <span className="preview-number">0{project.currentVersion.versionNumber}</span>
      </button>
      <div className="project-card-body">
        <div className="project-card-topline">
          <span className={`status-label status-${project.status}`}>
            {project.status === 'published' ? 'Published' : 'Draft'}
          </span>
          <span>Version {project.currentVersion.versionNumber}</span>
        </div>
        <h3>{project.title}</h3>
        <p>Updated {formatDate(project.updatedAt)}</p>
        <button className="text-button" onClick={onOpen} type="button">
          View project <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}

function ActivityRow({ activity, projects }: { activity: ActivityEvent; projects: GameProject[] }) {
  const project = projects.find((candidate) => candidate.id === activity.projectId);
  const isPublish = activity.type === 'publish';

  return (
    <article className="activity-row">
      <div className={`activity-icon ${isPublish ? 'activity-icon-mint' : ''}`} aria-hidden="true">
        {isPublish ? '↗' : '✦'}
      </div>
      <div className="activity-copy">
        <strong>{activityLabel(activity.type)}</strong>
        <span>{project?.title ?? 'Project'}</span>
      </div>
      <time dateTime={activity.createdAt}>{formatDate(activity.createdAt)}</time>
    </article>
  );
}

function ProjectDetail({ project, onBack }: { project: GameProject; onBack: () => void }) {
  const [insight, setInsight] = useState<ProjectInsight | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    setIsLoadingInsight(true);
    void parentApi
      .loadInsight(project.id)
      .then((result) => {
        if (isActive) setInsight(result);
      })
      .catch((error: unknown) => {
        if (isActive) setErrorMessage(messageFrom(error));
      })
      .finally(() => {
        if (isActive) setIsLoadingInsight(false);
      });
    return () => {
      isActive = false;
    };
  }, [project.id]);

  const generateInsight = useCallback(async () => {
    setIsLoadingInsight(true);
    setErrorMessage(null);
    try {
      setInsight(await parentApi.generateInsight(project.id));
    } catch (error) {
      setErrorMessage(messageFrom(error));
    } finally {
      setIsLoadingInsight(false);
    }
  }, [project.id]);

  return (
    <div className="page-stack detail-page">
      <button className="back-button" onClick={onBack} type="button">← Back to projects</button>

      <section className="detail-heading">
        <div>
          <p className="eyebrow">PROJECT INSIGHT</p>
          <h1>{project.title}</h1>
          <p>
            Version {project.currentVersion.versionNumber} · Updated {formatDate(project.updatedAt)}
          </p>
        </div>
        <span className={`status-label status-${project.status}`}>
          {project.status === 'published' ? 'Published' : 'Draft'}
        </span>
      </section>

      <div className="detail-layout">
        <section aria-labelledby="preview-title" className="preview-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">PLAYABLE PREVIEW</p>
              <h2 id="preview-title">The latest build</h2>
            </div>
            <span>v{project.currentVersion.versionNumber}</span>
          </div>
          <div className="game-frame-shell">
            <iframe
              referrerPolicy="no-referrer"
              sandbox="allow-scripts"
              srcDoc={project.currentVersion.html}
              title={`${project.title} preview`}
            />
          </div>
        </section>

        <aside className="context-panel">
          <p className="panel-kicker">LATEST REQUEST</p>
          <blockquote>“{project.currentVersion.prompt}”</blockquote>
          <dl>
            <div><dt>Started</dt><dd>{formatDate(project.createdAt)}</dd></div>
            <div><dt>Versions</dt><dd>{project.currentVersion.versionNumber}</dd></div>
            <div><dt>Status</dt><dd>{project.status}</dd></div>
          </dl>
        </aside>
      </div>

      {errorMessage ? <ErrorNotice message={errorMessage} onRetry={() => void generateInsight()} /> : null}

      <section aria-labelledby="insight-title" className="insight-section">
        <SectionHeader
          detail="Evidence from this project only"
          id="insight-title"
          title="AI project observation"
        />
        {isLoadingInsight ? (
          <LoadingState label="Reading the project story…" />
        ) : insight ? (
          <InsightReport insight={insight} />
        ) : (
          <div className="generate-panel">
            <div>
              <p className="panel-kicker">CONVERSATION, NOT A SCORE</p>
              <h3>Turn this build into a talking point.</h3>
              <p>
                ImagineLab reads the project's prompts and versions to surface specific observations
                and questions you can explore together.
              </p>
            </div>
            <button className="primary-button" onClick={() => void generateInsight()} type="button">
              ✦ Generate observation
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function InsightReport({ insight }: { insight: ProjectInsight }) {
  return (
    <div className="insight-report">
      <article className="summary-card">
        <p className="panel-kicker">PROJECT SUMMARY</p>
        <p>{insight.summary}</p>
      </article>

      <div className="dimension-grid">
        {insight.dimensions.map((dimension, index) => (
          <article className="dimension-card" key={dimension.name}>
            <span className="dimension-index">0{index + 1}</span>
            <h3>{dimension.name}</h3>
            <p>{dimension.observation}</p>
            <ul>
              {dimension.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}
            </ul>
          </article>
        ))}
      </div>

      <div className="conversation-grid">
        <article className="interest-card">
          <p className="panel-kicker">INTEREST SIGNALS</p>
          <div className="interest-list">
            {insight.interests.map((interest) => <span key={interest}>{interest}</span>)}
          </div>
        </article>
        <article className="questions-card">
          <p className="panel-kicker">TRY ASKING</p>
          <ol>
            {insight.conversationStarters.map((question) => <li key={question}>{question}</li>)}
          </ol>
        </article>
      </div>

      <p className="disclaimer">{insight.disclaimer}</p>
    </div>
  );
}

function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-notice" role="alert">
      <span>{message}</span>
      <button onClick={onRetry} type="button">Try again</button>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="loading-mark" aria-hidden="true">✦</span>
      {label}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <span aria-hidden="true">✦</span>
      <h3>No projects yet</h3>
      <p>Alex's games will appear here after the first creation in the ImagineLab app.</p>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(value),
  );
}

function activityLabel(type: ActivityEvent['type']): string {
  const labels: Record<ActivityEvent['type'], string> = {
    create: 'Created a new game',
    edit: 'Built a new version',
    publish: 'Published a game',
    unpublish: 'Unpublished a game',
    insight_generated: 'Generated a parent observation',
  };
  return labels[type];
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Something unexpected happened.';
}

export default App;
