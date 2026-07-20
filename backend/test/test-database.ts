import { Pool } from "pg";

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://imaginelab:imaginelab_local@localhost:5432/imaginelab_test";

export async function resetTestDatabase(): Promise<void> {
  const pool = new Pool({ connectionString: testDatabaseUrl });
  try {
    await pool.query("truncate table users cascade");
  } finally {
    await pool.end();
  }
}
