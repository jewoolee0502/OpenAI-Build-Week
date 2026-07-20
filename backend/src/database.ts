import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient, type PoolConfig } from "pg";

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "../migrations");

export class Database {
  public readonly pool: Pool;

  public constructor(connectionString: string, options: Partial<PoolConfig> = {}) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 30_000,
      ...options,
    });
  }

  public async migrate(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        create table if not exists schema_migrations (
          version text primary key,
          applied_at timestamptz not null default now()
        )
      `);
      const appliedResult = await client.query<{ version: string }>(
        "select version from schema_migrations",
      );
      const applied = new Set(appliedResult.rows.map((row) => row.version));
      const files = (await readdir(migrationsDirectory))
        .filter((file) => file.endsWith(".sql"))
        .sort();

      for (const file of files) {
        if (applied.has(file)) continue;
        const sql = await readFile(join(migrationsDirectory, file), "utf8");
        await client.query("begin");
        try {
          await client.query(sql);
          await client.query("insert into schema_migrations (version) values ($1)", [file]);
          await client.query("commit");
        } catch (error) {
          await client.query("rollback");
          throw error;
        }
      }
    } finally {
      client.release();
    }
  }

  public async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await operation(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
