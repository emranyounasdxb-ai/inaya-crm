import "./check-runtime.mjs";
import { execFile } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import pg from "pg";
import { privateWrite } from "./app-config.mjs";

const execute = promisify(execFile);
export const backupRoot = join(homedir(), ".inaya-crm", "backups");
const statusPath = resolve(".local/backup-status.json");
export function backupStatus() {
  if (!existsSync(statusPath)) return { lastSuccess: null, lastRestore: null, lastAttemptFailed: false };
  const data = JSON.parse(readFileSync(statusPath, "utf8"));
  return { lastSuccess: data.lastSuccess ?? null, lastRestore: data.lastRestore ?? null, lastAttemptFailed: Boolean(data.lastAttemptFailed) };
}
async function restrictDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  if (process.platform === "win32")
    await execute("icacls.exe", [path, "/inheritance:r", "/grant:r", `${userInfo().username}:(OI)(CI)F`, "SYSTEM:(OI)(CI)F"], { windowsHide: true });
}
export async function fingerprints(client) {
  const tables = await client.query("SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('public','drizzle') ORDER BY schemaname, tablename");
  const result = {};
  for (const { schemaname, tablename } of tables.rows) {
    const quote = (value) => `"${value.replaceAll('"', '""')}"`;
    const { rows } = await client.query(`SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)),'')) AS hash FROM ${quote(schemaname)}.${quote(tablename)} t`);
    result[`${schemaname}.${tablename}`] = rows[0];
  }
  return result;
}
let running;
export function backupDatabase({ daily = false } = {}) {
  if (running) return running;
  running = performBackup(daily).finally(() => { running = undefined; });
  return running;
}
async function performBackup(daily) {
  const old = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, "utf8")) : {};
  const day = (date) => new Date(new Date(date).getTime() + 4 * 3600000).toISOString().slice(0, 10);
  if (daily && old.lastSuccess && day(old.lastSuccess) === day(new Date())) return { skipped: true };
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");
  await restrictDirectory(backupRoot);
  const tools = JSON.parse(readFileSync(".local/tooling.json", "utf8"));
  const url = new URL(process.env.DATABASE_URL);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/inaya_crm") throw new Error("Local backups require the configured local CRM database.");
  const stem = `inaya-${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const dump = join(backupRoot, `${stem}.dump`);
  const pending = `${dump}.partial`;
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = (await client.query("SELECT pg_export_snapshot() AS id")).rows[0].id;
    const tables = await fingerprints(client);
    await execute(join(tools.postgresBin, "pg_dump.exe"), ["--format=custom", "--no-owner", "--no-privileges", "--schema=public", "--schema=drizzle", `--snapshot=${snapshot}`, `--file=${pending}`], {
      windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024,
      env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: "inaya_crm", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password) },
    });
    await client.query("COMMIT");
    renameSync(pending, dump);
    const sha256 = createHash("sha256").update(readFileSync(dump)).digest("hex");
    privateWrite(join(backupRoot, `${stem}.manifest.json`), JSON.stringify({ schemaVersion: 1, createdAt: new Date().toISOString(), database: "inaya_crm", dump: basename(dump), sha256, tables }, null, 2));
    if (existsSync(".local/app-secrets.json")) privateWrite(join(backupRoot, `${stem}.app-secrets.json`), readFileSync(".local/app-secrets.json", "utf8"));
    privateWrite(statusPath, JSON.stringify({ ...old, lastSuccess: new Date().toISOString(), lastAttemptFailed: false, latestManifest: join(backupRoot, `${stem}.manifest.json`) }, null, 2));
    console.log(`Backup saved and checksummed: ${dump}`);
    return { dump, manifest: join(backupRoot, `${stem}.manifest.json`) };
  } catch {
    privateWrite(statusPath, JSON.stringify({ ...old, lastAttemptFailed: true, lastAttemptAt: new Date().toISOString() }, null, 2));
    // Child-process errors can contain environment/connection details; never print them.
    throw new Error("Database backup failed. Existing backups remain intact.");
  } finally {
    await client.end();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve("scripts/backup.mjs"))
  await backupDatabase({ daily: process.argv.includes("--daily") });
