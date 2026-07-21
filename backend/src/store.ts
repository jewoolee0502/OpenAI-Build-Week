import type { PoolClient, QueryResultRow } from "pg";
import type { Database } from "./database.js";
import {
  activityTypeSchema,
  projectInsightSchema,
  projectStatusSchema,
  type ActivityEvent,
  type ActivityType,
  type AuthenticatedUser,
  type BuilderDraft,
  type ChildAccount,
  type ChildInsight,
  type GuardianAccount,
  type LinkedChild,
  type Project,
  type ProjectInsight,
  type ProjectInsightContent,
  type ProjectProfileImage,
  type ProjectVersion,
  type ProjectWithCurrentVersion,
} from "./domain.js";
import type { GeneratedProjectImage } from "./project-image.js";

export type SessionKind = "child_guest" | "guardian_web";

export interface GuardianCredentials extends GuardianAccount {
  passwordHash: string;
}

export interface ProjectWithVersions extends ProjectWithCurrentVersion {
  versions: ProjectVersion[];
}

export interface ApplicationStore {
  createGuestChild(input: {
    childId: string;
    displayName: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<ChildAccount>;
  createGuardian(input: {
    displayName: string;
    email: string;
    passwordHash: string;
  }): Promise<GuardianAccount>;
  findGuardianCredentials(email: string): Promise<GuardianCredentials | null>;
  createSession(input: {
    userId: string;
    tokenHash: string;
    kind: SessionKind;
    expiresAt: Date;
  }): Promise<void>;
  findSessionUser(tokenHash: string, kind: SessionKind): Promise<AuthenticatedUser | null>;
  revokeSession(tokenHash: string): Promise<void>;
  linkChild(guardianUserId: string, childId: string): Promise<LinkedChild | null>;
  unlinkChild(guardianUserId: string, childUserId: string): Promise<boolean>;
  listLinkedChildren(guardianUserId: string): Promise<LinkedChild[]>;
  createProject(input: {
    childUserId: string;
    title: string;
    prompt: string;
    html: string;
    profileImage: GeneratedProjectImage;
  }): Promise<ProjectWithCurrentVersion>;
  addVersion(input: {
    projectId: string;
    prompt: string;
    html: string;
  }): Promise<ProjectWithCurrentVersion | null>;
  listProjectsForChild(childUserId: string): Promise<ProjectWithCurrentVersion[]>;
  listProjectsWithVersionsForChild(childUserId: string): Promise<ProjectWithVersions[]>;
  getProject(projectId: string): Promise<ProjectWithCurrentVersion | null>;
  getProjectProfileImage(projectId: string): Promise<ProjectProfileImage | null>;
  deleteProject(projectId: string): Promise<boolean>;
  saveBuilderDraft(projectId: string, draft: BuilderDraft): Promise<ProjectWithCurrentVersion | null>;
  getVersions(projectId: string): Promise<ProjectVersion[]>;
  getActivities(childUserId: string, projectId?: string): Promise<ActivityEvent[]>;
  setPublished(projectId: string, published: boolean): Promise<ProjectWithCurrentVersion | null>;
  getPublishedProject(slug: string): Promise<ProjectWithCurrentVersion | null>;
  isGuardianLinked(guardianUserId: string, childUserId: string): Promise<boolean>;
  saveInsight(input: {
    project: Project;
    requestedByGuardianUserId: string;
    sourceVersionIds: string[];
    content: ProjectInsightContent;
  }): Promise<ProjectInsight>;
  getLatestInsight(projectId: string): Promise<ProjectInsight | null>;
  saveChildInsight(input: {
    childUserId: string;
    requestedByGuardianUserId: string;
    sourceProjectIds: string[];
    sourceVersionIds: string[];
    content: ProjectInsightContent;
  }): Promise<ChildInsight>;
  getLatestChildInsight(childUserId: string): Promise<ChildInsight | null>;
}

interface UserRow extends QueryResultRow {
  id: string;
  role: "child" | "guardian";
  display_name: string;
  email: string | null;
  password_hash: string | null;
  child_public_id: string | null;
  linked: boolean;
}

interface ProjectRow extends QueryResultRow {
  id: string;
  child_user_id: string;
  title: string;
  status: "draft" | "published";
  current_version_id: string;
  published_version_id: string | null;
  public_slug: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  builder_draft: BuilderDraft | null;
  version_id?: string;
  version_number?: number;
  version_prompt?: string;
  version_html?: string;
  version_created_at?: Date | string;
}

interface VersionRow extends QueryResultRow {
  id: string;
  project_id: string;
  version_number: number;
  prompt: string;
  html: string;
  created_at: Date | string;
}

interface ActivityRow extends QueryResultRow {
  id: string;
  child_user_id: string;
  project_id: string;
  type: string;
  metadata: ActivityEvent["metadata"];
  created_at: Date | string;
}

interface InsightRow extends QueryResultRow {
  id: string;
  project_id: string | null;
  child_user_id: string;
  scope: "project" | "portfolio";
  source_project_ids: string[];
  summary: string;
  dimensions: unknown;
  interests: unknown;
  conversation_starters: unknown;
  disclaimer: string;
  created_at: Date | string;
  rubric_version: string;
}

interface RadarValueRow extends QueryResultRow {
  dimension: string;
  level: number;
  label: string;
  observation: string;
  evidence: unknown;
}

interface ProjectProfileImageRow extends QueryResultRow {
  id: string;
  project_id: string;
  source_prompt: string;
  mime_type: "image/webp" | "image/svg+xml";
  image_data: Buffer;
  provider: "openai" | "demo";
  model: string;
  fallback_reason: "moderation_blocked" | "provider_error" | null;
  created_at: Date | string;
}

export class PostgresStore implements ApplicationStore {
  public constructor(private readonly database: Database) {}

  public async createGuestChild(input: {
    childId: string;
    displayName: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<ChildAccount> {
    return this.database.transaction(async (client) => {
      const result = await client.query<UserRow>(
        `insert into users (role, display_name, child_public_id)
         values ('child', $1, $2)
         returning id, role, display_name, email, password_hash, child_public_id, false as linked`,
        [input.displayName, input.childId],
      );
      const user = result.rows[0];
      if (!user) throw new Error("Could not create child account");
      await client.query(
        `insert into auth_sessions (user_id, token_hash, kind, expires_at)
         values ($1, $2, 'child_guest', $3)`,
        [user.id, input.tokenHash, input.expiresAt],
      );
      return childAccount(user);
    });
  }

  public async createGuardian(input: {
    displayName: string;
    email: string;
    passwordHash: string;
  }): Promise<GuardianAccount> {
    try {
      const result = await this.database.pool.query<UserRow>(
        `insert into users (role, display_name, email, password_hash)
         values ('guardian', $1, $2, $3)
         returning id, role, display_name, email, password_hash, child_public_id, false as linked`,
        [input.displayName, input.email, input.passwordHash],
      );
      const user = result.rows[0];
      if (!user) throw new Error("Could not create guardian account");
      return guardianAccount(user);
    } catch (error) {
      if (isUniqueViolation(error)) throw httpError(409, "An account already uses this email");
      throw error;
    }
  }

  public async findGuardianCredentials(email: string): Promise<GuardianCredentials | null> {
    const result = await this.database.pool.query<UserRow>(
      `select id, role, display_name, email, password_hash, child_public_id, false as linked
       from users where role = 'guardian' and lower(email) = lower($1)`,
      [email],
    );
    const row = result.rows[0];
    if (!row?.email || !row.password_hash) return null;
    return { ...guardianAccount(row), passwordHash: row.password_hash };
  }

  public async createSession(input: {
    userId: string;
    tokenHash: string;
    kind: SessionKind;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.pool.query(
      `insert into auth_sessions (user_id, token_hash, kind, expires_at)
       values ($1, $2, $3, $4)`,
      [input.userId, input.tokenHash, input.kind, input.expiresAt],
    );
  }

  public async findSessionUser(
    tokenHash: string,
    kind: SessionKind,
  ): Promise<AuthenticatedUser | null> {
    const result = await this.database.pool.query<UserRow>(
      `select u.id, u.role, u.display_name, u.email, u.password_hash, u.child_public_id,
              exists (
                select 1 from guardian_links gl
                where gl.child_user_id = u.id and gl.status = 'active'
              ) as linked
       from auth_sessions s
       join users u on u.id = s.user_id
       where s.token_hash = $1 and s.kind = $2 and s.revoked_at is null and s.expires_at > now()`,
      [tokenHash, kind],
    );
    const row = result.rows[0];
    if (!row) return null;
    await this.database.pool.query(
      "update auth_sessions set last_used_at = now() where token_hash = $1",
      [tokenHash],
    );
    return row.role === "child" ? childAccount(row) : guardianAccount(row);
  }

  public async revokeSession(tokenHash: string): Promise<void> {
    await this.database.pool.query(
      "update auth_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null",
      [tokenHash],
    );
  }

  public async linkChild(guardianUserId: string, childId: string): Promise<LinkedChild | null> {
    return this.database.transaction(async (client) => {
      const childResult = await client.query<UserRow>(
        `select id, role, display_name, email, password_hash, child_public_id, true as linked
         from users where role = 'child' and child_public_id = $1`,
        [childId],
      );
      const child = childResult.rows[0];
      if (!child) return null;
      await client.query(
        `insert into guardian_links (guardian_user_id, child_user_id, status, linked_at)
         values ($1, $2, 'active', now())
         on conflict (guardian_user_id, child_user_id)
         do update set status = 'active', linked_at = now()`,
        [guardianUserId, child.id],
      );
      return { ...childAccount(child), linkStatus: "active" };
    });
  }

  public async unlinkChild(guardianUserId: string, childUserId: string): Promise<boolean> {
    const result = await this.database.pool.query(
      `update guardian_links
       set status = 'revoked'
       where guardian_user_id = $1 and child_user_id = $2 and status = 'active'`,
      [guardianUserId, childUserId],
    );
    return result.rowCount === 1;
  }

  public async listLinkedChildren(guardianUserId: string): Promise<LinkedChild[]> {
    const result = await this.database.pool.query<UserRow & { link_status: LinkedChild["linkStatus"] }>(
      `select u.id, u.role, u.display_name, u.email, u.password_hash, u.child_public_id,
              true as linked, gl.status as link_status
       from guardian_links gl
       join users u on u.id = gl.child_user_id
       where gl.guardian_user_id = $1 and gl.status = 'active'
       order by u.created_at`,
      [guardianUserId],
    );
    return result.rows.map((row) => ({ ...childAccount(row), linkStatus: row.link_status }));
  }

  public async createProject(input: {
    childUserId: string;
    title: string;
    prompt: string;
    html: string;
    profileImage: GeneratedProjectImage;
  }): Promise<ProjectWithCurrentVersion> {
    return this.database.transaction(async (client) => {
      const projectResult = await client.query<ProjectRow>(
        `insert into projects (child_user_id, title)
         values ($1, $2)
         returning *`,
        [input.childUserId, input.title],
      );
      const projectRow = projectResult.rows[0];
      if (!projectRow) throw new Error("Could not create project");
      const versionResult = await client.query<VersionRow>(
        `insert into project_versions (project_id, version_number, prompt, html)
         values ($1, 1, $2, $3)
         returning *`,
        [projectRow.id, input.prompt, input.html],
      );
      const versionRow = versionResult.rows[0];
      if (!versionRow) throw new Error("Could not create project version");
      const updatedResult = await client.query<ProjectRow>(
        `update projects set current_version_id = $2 where id = $1 returning *`,
        [projectRow.id, versionRow.id],
      );
      await client.query(
        `insert into project_profile_images (
           project_id, source_prompt, mime_type, image_data, provider, model, fallback_reason
         ) values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          projectRow.id,
          input.profileImage.sourcePrompt,
          input.profileImage.mimeType,
          input.profileImage.data,
          input.profileImage.provider,
          input.profileImage.model,
          input.profileImage.fallbackReason ?? null,
        ],
      );
      await this.insertActivity(client, input.childUserId, projectRow.id, "create", {
        prompt: input.prompt,
        versionNumber: 1,
      });
      return withVersion(projectFromRow(requiredRow(updatedResult.rows[0])), versionFromRow(versionRow));
    });
  }

  public async addVersion(input: {
    projectId: string;
    prompt: string;
    html: string;
  }): Promise<ProjectWithCurrentVersion | null> {
    return this.database.transaction(async (client) => {
      const locked = await client.query<ProjectRow>(
        "select * from projects where id = $1 for update",
        [input.projectId],
      );
      const projectRow = locked.rows[0];
      if (!projectRow) return null;
      const versionResult = await client.query<VersionRow>(
        `insert into project_versions (project_id, version_number, prompt, html)
         select $1, coalesce(max(version_number), 0) + 1, $2, $3
         from project_versions where project_id = $1
         returning *`,
        [input.projectId, input.prompt, input.html],
      );
      const versionRow = requiredRow(versionResult.rows[0]);
      const updated = await client.query<ProjectRow>(
        `update projects set current_version_id = $2, updated_at = now()
         where id = $1 returning *`,
        [input.projectId, versionRow.id],
      );
      await this.insertActivity(client, projectRow.child_user_id, projectRow.id, "edit", {
        instruction: input.prompt,
        versionNumber: versionRow.version_number,
      });
      return withVersion(projectFromRow(requiredRow(updated.rows[0])), versionFromRow(versionRow));
    });
  }

  public async listProjectsForChild(childUserId: string): Promise<ProjectWithCurrentVersion[]> {
    const result = await this.database.pool.query<ProjectRow>(
      `${projectWithVersionSelect} where p.child_user_id = $1 order by p.updated_at desc`,
      [childUserId],
    );
    return result.rows.map(projectWithVersionFromRow);
  }

  public async listProjectsWithVersionsForChild(
    childUserId: string,
  ): Promise<ProjectWithVersions[]> {
    const projects = await this.listProjectsForChild(childUserId);
    if (projects.length === 0) return [];
    const result = await this.database.pool.query<VersionRow>(
      `select v.* from project_versions v
       join projects p on p.id = v.project_id
       where p.child_user_id = $1
       order by v.project_id, v.version_number`,
      [childUserId],
    );
    const versionsByProject = new Map<string, ProjectVersion[]>();
    for (const row of result.rows) {
      const version = versionFromRow(row);
      const versions = versionsByProject.get(version.projectId) ?? [];
      versions.push(version);
      versionsByProject.set(version.projectId, versions);
    }
    return projects.map((project) => ({
      ...project,
      versions: versionsByProject.get(project.id) ?? [],
    }));
  }

  public async getProject(projectId: string): Promise<ProjectWithCurrentVersion | null> {
    const result = await this.database.pool.query<ProjectRow>(
      `${projectWithVersionSelect} where p.id = $1`,
      [projectId],
    );
    return result.rows[0] ? projectWithVersionFromRow(result.rows[0]) : null;
  }

  public async getProjectProfileImage(projectId: string): Promise<ProjectProfileImage | null> {
    const result = await this.database.pool.query<ProjectProfileImageRow>(
      "select * from project_profile_images where project_id = $1",
      [projectId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      sourcePrompt: row.source_prompt,
      mimeType: row.mime_type,
      data: row.image_data,
      provider: row.provider,
      model: row.model,
      fallbackReason: row.fallback_reason,
      createdAt: iso(row.created_at),
    };
  }

  public async deleteProject(projectId: string): Promise<boolean> {
    const result = await this.database.pool.query("delete from projects where id = $1", [projectId]);
    return result.rowCount === 1;
  }

  public async saveBuilderDraft(
    projectId: string,
    draft: BuilderDraft,
  ): Promise<ProjectWithCurrentVersion | null> {
    const result = await this.database.pool.query(
      `update projects set builder_draft = $2::jsonb, updated_at = now() where id = $1`,
      [projectId, JSON.stringify(draft)],
    );
    return result.rowCount === 1 ? this.getProject(projectId) : null;
  }

  public async getVersions(projectId: string): Promise<ProjectVersion[]> {
    const result = await this.database.pool.query<VersionRow>(
      "select * from project_versions where project_id = $1 order by version_number",
      [projectId],
    );
    return result.rows.map(versionFromRow);
  }

  public async getActivities(childUserId: string, projectId?: string): Promise<ActivityEvent[]> {
    const values: string[] = [childUserId];
    const projectFilter = projectId ? " and project_id = $2" : "";
    if (projectId) values.push(projectId);
    const result = await this.database.pool.query<ActivityRow>(
      `select * from activity_events where child_user_id = $1${projectFilter}
       order by created_at desc`,
      values,
    );
    return result.rows.map((row) => ({
      id: row.id,
      childUserId: row.child_user_id,
      projectId: row.project_id,
      type: activityTypeSchema.parse(row.type),
      createdAt: iso(row.created_at),
      metadata: row.metadata,
    }));
  }

  public async setPublished(
    projectId: string,
    published: boolean,
  ): Promise<ProjectWithCurrentVersion | null> {
    return this.database.transaction(async (client) => {
      const locked = await client.query<ProjectRow>(
        "select * from projects where id = $1 for update",
        [projectId],
      );
      const current = locked.rows[0];
      if (!current) return null;
      const slug = current.public_slug ?? createSlug(current.title, current.id);
      const result = await client.query<ProjectRow>(
        `update projects
         set status = $2,
             public_slug = $3,
             published_version_id = case when $4 then current_version_id else null end,
             updated_at = now()
         where id = $1 returning *`,
        [projectId, published ? "published" : "draft", slug, published],
      );
      await this.insertActivity(
        client,
        current.child_user_id,
        current.id,
        published ? "publish" : "unpublish",
        { publicSlug: slug },
      );
      const project = projectFromRow(requiredRow(result.rows[0]));
      const version = await this.getVersionWithClient(client, project.currentVersionId);
      return withVersion(project, version);
    });
  }

  public async getPublishedProject(slug: string): Promise<ProjectWithCurrentVersion | null> {
    const result = await this.database.pool.query<ProjectRow>(
      `select p.*,
              v.id as version_id, v.version_number, v.prompt as version_prompt,
              v.html as version_html, v.created_at as version_created_at
       from projects p
       join project_versions v on v.id = p.published_version_id
       where p.public_slug = $1 and p.status = 'published'`,
      [slug],
    );
    return result.rows[0] ? projectWithVersionFromRow(result.rows[0]) : null;
  }

  public async isGuardianLinked(guardianUserId: string, childUserId: string): Promise<boolean> {
    const result = await this.database.pool.query(
      `select 1 from guardian_links
       where guardian_user_id = $1 and child_user_id = $2 and status = 'active'`,
      [guardianUserId, childUserId],
    );
    return result.rowCount === 1;
  }

  public async saveInsight(input: {
    project: Project;
    requestedByGuardianUserId: string;
    sourceVersionIds: string[];
    content: ProjectInsightContent;
  }): Promise<ProjectInsight> {
    const content = projectInsightSchema.parse(input.content);
    return this.database.transaction(async (client) => {
      const insightResult = await client.query<InsightRow>(
        `insert into project_insights (
           child_user_id, project_id, requested_by_guardian_user_id, summary,
           dimensions, interests, conversation_starters, disclaimer, scope, source_project_ids
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, 'project', $9::uuid[])
         returning *, $10::text as rubric_version`,
        [
          input.project.childUserId,
          input.project.id,
          input.requestedByGuardianUserId,
          content.summary,
          JSON.stringify(content.dimensions),
          JSON.stringify(content.interests),
          JSON.stringify(content.conversationStarters),
          content.disclaimer,
          [input.project.id],
          content.radar.rubricVersion,
        ],
      );
      const insightRow = requiredRow(insightResult.rows[0]);
      const snapshotResult = await client.query<{ id: string }>(
        `insert into creative_dimension_snapshots (
           child_user_id, project_id, insight_id, scope, rubric_version, source_version_ids
         ) values ($1, $2, $3, 'project', $4, $5::uuid[])
         returning id`,
        [
          input.project.childUserId,
          input.project.id,
          insightRow.id,
          content.radar.rubricVersion,
          input.sourceVersionIds,
        ],
      );
      const snapshotId = requiredRow(snapshotResult.rows[0]).id;
      for (const dimension of content.radar.dimensions) {
        await client.query(
          `insert into creative_dimension_values (
             snapshot_id, dimension, level, label, observation, evidence
           ) values ($1, $2, $3, $4, $5, $6)`,
          [
            snapshotId,
            dimension.key,
            dimension.level,
            dimension.label,
            dimension.observation,
            JSON.stringify(dimension.evidence),
          ],
        );
      }
      await this.insertActivity(
        client,
        input.project.childUserId,
        input.project.id,
        "insight_generated",
        { insightId: insightRow.id },
      );
      return {
        id: insightRow.id,
        projectId: input.project.id,
        childUserId: insightRow.child_user_id,
        createdAt: iso(insightRow.created_at),
        ...content,
      };
    });
  }

  public async getLatestInsight(projectId: string): Promise<ProjectInsight | null> {
    const insightResult = await this.database.pool.query<InsightRow>(
      `select i.*, s.rubric_version
       from project_insights i
       join creative_dimension_snapshots s on s.insight_id = i.id
       where i.project_id = $1 and i.scope = 'project'
       order by i.created_at desc limit 1`,
      [projectId],
    );
    const row = insightResult.rows[0];
    if (!row?.project_id) return null;
    const parsed = await this.loadInsightContent(row);
    return {
      id: row.id,
      projectId: row.project_id,
      childUserId: row.child_user_id,
      createdAt: iso(row.created_at),
      ...parsed,
    };
  }

  public async saveChildInsight(input: {
    childUserId: string;
    requestedByGuardianUserId: string;
    sourceProjectIds: string[];
    sourceVersionIds: string[];
    content: ProjectInsightContent;
  }): Promise<ChildInsight> {
    const content = projectInsightSchema.parse(input.content);
    return this.database.transaction(async (client) => {
      const insightResult = await client.query<InsightRow>(
        `insert into project_insights (
           child_user_id, project_id, requested_by_guardian_user_id, summary,
           dimensions, interests, conversation_starters, disclaimer, scope, source_project_ids
         ) values ($1, null, $2, $3, $4, $5, $6, $7, 'portfolio', $8::uuid[])
         returning *, $9::text as rubric_version`,
        [
          input.childUserId,
          input.requestedByGuardianUserId,
          content.summary,
          JSON.stringify(content.dimensions),
          JSON.stringify(content.interests),
          JSON.stringify(content.conversationStarters),
          content.disclaimer,
          input.sourceProjectIds,
          content.radar.rubricVersion,
        ],
      );
      const insightRow = requiredRow(insightResult.rows[0]);
      const snapshotResult = await client.query<{ id: string }>(
        `insert into creative_dimension_snapshots (
           child_user_id, project_id, insight_id, scope, rubric_version, source_version_ids
         ) values ($1, null, $2, 'portfolio', $3, $4::uuid[])
         returning id`,
        [
          input.childUserId,
          insightRow.id,
          content.radar.rubricVersion,
          input.sourceVersionIds,
        ],
      );
      const snapshotId = requiredRow(snapshotResult.rows[0]).id;
      for (const dimension of content.radar.dimensions) {
        await client.query(
          `insert into creative_dimension_values (
             snapshot_id, dimension, level, label, observation, evidence
           ) values ($1, $2, $3, $4, $5, $6)`,
          [
            snapshotId,
            dimension.key,
            dimension.level,
            dimension.label,
            dimension.observation,
            JSON.stringify(dimension.evidence),
          ],
        );
      }
      return {
        id: insightRow.id,
        childUserId: insightRow.child_user_id,
        scope: "portfolio",
        sourceProjectIds: insightRow.source_project_ids,
        createdAt: iso(insightRow.created_at),
        ...content,
      };
    });
  }

  public async getLatestChildInsight(childUserId: string): Promise<ChildInsight | null> {
    const insightResult = await this.database.pool.query<InsightRow>(
      `select i.*, s.rubric_version
       from project_insights i
       join creative_dimension_snapshots s on s.insight_id = i.id
       where i.child_user_id = $1 and i.scope = 'portfolio'
       order by i.created_at desc limit 1`,
      [childUserId],
    );
    const row = insightResult.rows[0];
    if (!row) return null;
    const parsed = await this.loadInsightContent(row);
    return {
      id: row.id,
      childUserId: row.child_user_id,
      scope: "portfolio",
      sourceProjectIds: row.source_project_ids,
      createdAt: iso(row.created_at),
      ...parsed,
    };
  }

  private async loadInsightContent(row: InsightRow): Promise<ProjectInsightContent> {
    const radarResult = await this.database.pool.query<RadarValueRow>(
      `select v.dimension, v.level, v.label, v.observation, v.evidence
       from creative_dimension_values v
       join creative_dimension_snapshots s on s.id = v.snapshot_id
       where s.insight_id = $1
       order by array_position(
         array['imagination','expression','game_design','experimentation','iteration','reflection'],
         v.dimension
       )`,
      [row.id],
    );
    return projectInsightSchema.parse({
      summary: row.summary,
      dimensions: row.dimensions,
      interests: row.interests,
      conversationStarters: row.conversation_starters,
      disclaimer: row.disclaimer,
      radar: {
        rubricVersion: row.rubric_version,
        dimensions: radarResult.rows.map((value) => ({
          key: value.dimension,
          level: value.level,
          label: value.label,
          observation: value.observation,
          evidence: value.evidence,
        })),
      },
    });
  }

  private async insertActivity(
    client: PoolClient,
    childUserId: string,
    projectId: string,
    type: ActivityType,
    metadata: ActivityEvent["metadata"],
  ): Promise<void> {
    await client.query(
      `insert into activity_events (child_user_id, project_id, type, metadata)
       values ($1, $2, $3, $4)`,
      [childUserId, projectId, type, JSON.stringify(metadata)],
    );
  }

  private async getVersionWithClient(client: PoolClient, versionId: string): Promise<ProjectVersion> {
    const result = await client.query<VersionRow>(
      "select * from project_versions where id = $1",
      [versionId],
    );
    return versionFromRow(requiredRow(result.rows[0]));
  }
}

const projectWithVersionSelect = `
  select p.*,
         v.id as version_id, v.version_number, v.prompt as version_prompt,
         v.html as version_html, v.created_at as version_created_at
  from projects p
  join project_versions v on v.id = p.current_version_id
`;

function childAccount(row: UserRow): ChildAccount {
  if (!row.child_public_id) throw new Error("Child account is missing its public ID");
  return {
    id: row.id,
    role: "child",
    displayName: row.display_name,
    childId: row.child_public_id,
    linked: row.linked,
  };
}

function guardianAccount(row: UserRow): GuardianAccount {
  if (!row.email) throw new Error("Guardian account is missing its email");
  return {
    id: row.id,
    role: "guardian",
    displayName: row.display_name,
    email: row.email,
  };
}

function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    childUserId: row.child_user_id,
    title: row.title,
    status: projectStatusSchema.parse(row.status),
    currentVersionId: row.current_version_id,
    publishedVersionId: row.published_version_id,
    publicSlug: row.public_slug,
    profileImageUrl: `/api/projects/${row.id}/profile-image`,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    ...(row.builder_draft ? { builder: row.builder_draft } : {}),
  };
}

function versionFromRow(row: VersionRow): ProjectVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    versionNumber: row.version_number,
    prompt: row.prompt,
    html: row.html,
    createdAt: iso(row.created_at),
  };
}

function projectWithVersionFromRow(row: ProjectRow): ProjectWithCurrentVersion {
  if (
    !row.version_id ||
    row.version_number === undefined ||
    row.version_prompt === undefined ||
    row.version_html === undefined ||
    row.version_created_at === undefined
  ) {
    throw new Error("Project query did not include its current version");
  }
  return withVersion(projectFromRow(row), {
    id: row.version_id,
    projectId: row.id,
    versionNumber: row.version_number,
    prompt: row.version_prompt,
    html: row.version_html,
    createdAt: iso(row.version_created_at),
  });
}

function withVersion(project: Project, currentVersion: ProjectVersion): ProjectWithCurrentVersion {
  return { ...project, currentVersion };
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function requiredRow<Row>(row: Row | undefined): Row {
  if (!row) throw new Error("Database operation did not return a row");
  return row;
}

function createSlug(title: string, projectId: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return `${normalized || "game"}-${projectId.slice(0, 8)}`;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function httpError(statusCode: number, message: string): Error {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}
