import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  ActivityEvent,
  ActivityType,
  DatabaseShape,
  Project,
  ProjectInsight,
  ProjectInsightContent,
  ProjectVersion,
  ProjectWithCurrentVersion,
} from "./domain.js";

const emptyDatabase = (): DatabaseShape => ({
  projects: [],
  versions: [],
  activities: [],
  insights: [],
  guardianLinks: [
    { guardianUserId: "demo-guardian", childUserId: "demo-child", status: "active" },
  ],
});

export class LocalProjectStore {
  private writeQueue: Promise<void> = Promise.resolve();

  public constructor(private readonly filePath: string) {}

  private async read(): Promise<DatabaseShape> {
    try {
      const database = JSON.parse(await readFile(this.filePath, "utf8")) as DatabaseShape;
      database.projects = database.projects.map((project) => ({
        ...project,
        publishedVersionId:
          project.publishedVersionId ??
          (project.status === "published" ? project.currentVersionId : null),
      }));
      return database;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyDatabase();
      throw error;
    }
  }

  private async persist(database: DatabaseShape): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }

  private async mutate<T>(operation: (database: DatabaseShape) => T | Promise<T>): Promise<T> {
    const operationPromise = this.writeQueue.catch(() => undefined).then(async () => {
      const database = await this.read();
      const result = await operation(database);
      await this.persist(database);
      return result;
    });
    this.writeQueue = operationPromise.then(
      () => undefined,
      () => undefined,
    );
    return operationPromise;
  }

  public async createProject(input: {
    childUserId: string;
    title: string;
    prompt: string;
    html: string;
  }): Promise<ProjectWithCurrentVersion> {
    return this.mutate((database) => {
      const now = new Date().toISOString();
      const projectId = randomUUID();
      const version: ProjectVersion = {
        id: randomUUID(),
        projectId,
        versionNumber: 1,
        prompt: input.prompt,
        html: input.html,
        createdAt: now,
      };
      const project: Project = {
        id: projectId,
        childUserId: input.childUserId,
        title: input.title,
        status: "draft",
        currentVersionId: version.id,
        publishedVersionId: null,
        publicSlug: null,
        createdAt: now,
        updatedAt: now,
      };
      database.projects.push(project);
      database.versions.push(version);
      database.activities.push(
        this.activity(project, "create", { prompt: input.prompt, versionNumber: 1 }),
      );
      return { ...project, currentVersion: version };
    });
  }

  public async addVersion(input: {
    projectId: string;
    prompt: string;
    html: string;
  }): Promise<ProjectWithCurrentVersion | null> {
    return this.mutate((database) => {
      const project = database.projects.find((candidate) => candidate.id === input.projectId);
      if (!project) return null;
      const existingVersions = database.versions.filter(
        (version) => version.projectId === project.id,
      );
      const now = new Date().toISOString();
      const version: ProjectVersion = {
        id: randomUUID(),
        projectId: project.id,
        versionNumber: existingVersions.length + 1,
        prompt: input.prompt,
        html: input.html,
        createdAt: now,
      };
      project.currentVersionId = version.id;
      project.updatedAt = now;
      database.versions.push(version);
      database.activities.push(
        this.activity(project, "edit", {
          instruction: input.prompt,
          versionNumber: version.versionNumber,
        }),
      );
      return { ...project, currentVersion: version };
    });
  }

  public async listProjectsForChild(childUserId: string): Promise<ProjectWithCurrentVersion[]> {
    const database = await this.read();
    return database.projects
      .filter((project) => project.childUserId === childUserId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((project) => this.withCurrentVersion(database, project))
      .filter((project): project is ProjectWithCurrentVersion => project !== null);
  }

  public async getProject(projectId: string): Promise<ProjectWithCurrentVersion | null> {
    const database = await this.read();
    const project = database.projects.find((candidate) => candidate.id === projectId);
    return project ? this.withCurrentVersion(database, project) : null;
  }

  public async getVersions(projectId: string): Promise<ProjectVersion[]> {
    const database = await this.read();
    return database.versions
      .filter((version) => version.projectId === projectId)
      .sort((left, right) => left.versionNumber - right.versionNumber);
  }

  public async getActivities(childUserId: string, projectId?: string): Promise<ActivityEvent[]> {
    const database = await this.read();
    return database.activities
      .filter(
        (activity) =>
          activity.childUserId === childUserId &&
          (projectId === undefined || activity.projectId === projectId),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  public async setPublished(
    projectId: string,
    published: boolean,
  ): Promise<ProjectWithCurrentVersion | null> {
    return this.mutate((database) => {
      const project = database.projects.find((candidate) => candidate.id === projectId);
      if (!project) return null;
      const now = new Date().toISOString();
      project.status = published ? "published" : "draft";
      project.publicSlug = project.publicSlug ?? this.createSlug(project);
      project.publishedVersionId = published ? project.currentVersionId : null;
      project.updatedAt = now;
      database.activities.push(
        this.activity(project, published ? "publish" : "unpublish", {
          publicSlug: project.publicSlug,
        }),
      );
      return this.withCurrentVersion(database, project);
    });
  }

  public async getPublishedProject(slug: string): Promise<ProjectWithCurrentVersion | null> {
    const database = await this.read();
    const project = database.projects.find(
      (candidate) => candidate.publicSlug === slug && candidate.status === "published",
    );
    if (!project?.publishedVersionId) return null;
    const publishedVersion = database.versions.find(
      (version) => version.id === project.publishedVersionId,
    );
    return publishedVersion ? { ...project, currentVersion: publishedVersion } : null;
  }

  public async isGuardianLinked(guardianUserId: string, childUserId: string): Promise<boolean> {
    const database = await this.read();
    return database.guardianLinks.some(
      (link) =>
        link.guardianUserId === guardianUserId &&
        link.childUserId === childUserId &&
        link.status === "active",
    );
  }

  public async saveInsight(
    project: Project,
    content: ProjectInsightContent,
  ): Promise<ProjectInsight> {
    return this.mutate((database) => {
      const insight: ProjectInsight = {
        id: randomUUID(),
        projectId: project.id,
        childUserId: project.childUserId,
        createdAt: new Date().toISOString(),
        ...content,
      };
      database.insights.push(insight);
      database.activities.push(
        this.activity(project, "insight_generated", { insightId: insight.id }),
      );
      return insight;
    });
  }

  public async getLatestInsight(projectId: string): Promise<ProjectInsight | null> {
    const database = await this.read();
    return (
      database.insights
        .filter((insight) => insight.projectId === projectId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
    );
  }

  private withCurrentVersion(
    database: DatabaseShape,
    project: Project,
  ): ProjectWithCurrentVersion | null {
    const currentVersion = database.versions.find(
      (version) => version.id === project.currentVersionId,
    );
    return currentVersion ? { ...project, currentVersion } : null;
  }

  private activity(
    project: Project,
    type: ActivityType,
    metadata: ActivityEvent["metadata"],
  ): ActivityEvent {
    return {
      id: randomUUID(),
      childUserId: project.childUserId,
      projectId: project.id,
      type,
      createdAt: new Date().toISOString(),
      metadata,
    };
  }

  private createSlug(project: Project): string {
    const title = project.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);
    return `${title || "game"}-${project.id.slice(0, 8)}`;
  }
}
