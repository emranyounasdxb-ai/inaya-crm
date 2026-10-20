import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { connectDatabase } from "../src/server/db/index.ts";

export async function testDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for isolated PostgreSQL tests.");
  const schema = `inaya_test_${randomUUID().replaceAll("-", "")}`;
  const { pool, db } = connectDatabase(process.env.DATABASE_URL, schema);
  if (!/^inaya_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe test schema.");
  await pool.query(`CREATE SCHEMA "${schema}"`);
  try {
    for (const file of readdirSync("migrations").filter((name) => name.endsWith(".sql")).sort()) {
      const migration = readFileSync(`migrations/${file}`, "utf8").replaceAll('"public".', `"${schema}".`);
      await pool.query(migration);
    }
  } catch (error) {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
    throw error;
  }
  return { pool, db, schema, async cleanup() {
    // Only this test-created namespace is removed. Public CRM tables are untouched.
    if (!/^inaya_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe test schema.");
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
  } };
}
