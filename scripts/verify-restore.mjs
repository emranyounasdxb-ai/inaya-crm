import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import pg from "pg";
import { fingerprints } from "./backup.mjs";
import { privateWrite } from "./app-config.mjs";
const [manifestPath, database] = process.argv.slice(2);
if (!/^inaya_restore_test_[a-f0-9]{32}$/.test(database ?? "")) throw new Error("Unsafe restore-test database name.");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (!/^inaya-[\w-]+\.dump$/.test(manifest.dump)) throw new Error("Invalid dump filename.");
const sha256 = createHash("sha256").update(readFileSync(join(dirname(manifestPath), manifest.dump))).digest("hex");
if (sha256 !== manifest.sha256) throw new Error("Backup checksum mismatch.");
const client = new pg.Client({ database }); // PG* environment supplied privately by PowerShell.
try {
  await client.connect();
  const actual = await fingerprints(client);
  if (JSON.stringify(actual) !== JSON.stringify(manifest.tables)) throw new Error("Restored row counts/content hashes differ from the backup snapshot.");
  const statusPath = resolve(".local/backup-status.json");
  const status = JSON.parse(readFileSync(statusPath, "utf8"));
  privateWrite(statusPath, JSON.stringify({ ...status, lastRestore: new Date().toISOString(), verifiedManifest: resolve(manifestPath) }, null, 2));
  console.log(`PASS: isolated restore matches ${Object.keys(actual).length} original tables, row counts and content hashes.`);
} finally { await client.end(); }
