import { existsSync, readFileSync, rmSync } from "node:fs";
import pg from "pg";
export default async function teardown() {
  if (!existsSync(".local/e2e-fixture.json")) return;
  const { schema } = JSON.parse(readFileSync(".local/e2e-fixture.json", "utf8"));
  if (!/^inaya_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe test schema.");
  process.loadEnvFile(".env.local");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await pool.end();
  }
  rmSync(".local/e2e-fixture.json", { force: true });
}
