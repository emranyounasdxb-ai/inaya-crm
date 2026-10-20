import "./check-runtime.mjs";
import { buildApp } from "../src/server/app.ts";
import { connectDatabase } from "../src/server/db/index.ts";
import { localConfig } from "./app-config.mjs";
import { backupDatabase, backupStatus } from "./backup.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");
const config = localConfig();
const { db, pool } = connectDatabase(process.env.DATABASE_URL);
const app = await buildApp({ db, ...config, serveWeb: true, logger: true, backupStatus });
const port = Number(process.env.PORT ?? (new URL(config.origin).port || "4310"));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");
await app.listen({ host: "127.0.0.1", port });
console.log(`Inaya CRM: ${config.origin}`);
console.log("First account: open the private .local/setup-link.txt link. No default password is installed.");
const runBackup = () => void backupDatabase({ daily: true }).catch(() => app.log.error("Local database backup failed; check backup status."));
runBackup();
const backupTimer = setInterval(runBackup, 60 * 60 * 1000);
backupTimer.unref();
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(backupTimer);
  await app.close();
  await pool.end();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
