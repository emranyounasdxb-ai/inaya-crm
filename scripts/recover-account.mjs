import "./check-runtime.mjs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { connectDatabase } from "../src/server/db/index.ts";
import { user } from "../src/server/db/schema.ts";
import { issueRecovery } from "../src/server/services/recovery.ts";
import { localConfig, privateWrite } from "./app-config.mjs";
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !process.env.DATABASE_URL) throw new Error("Usage: inaya.cmd recover:account administrator@example.com");
const { db, pool } = connectDatabase(process.env.DATABASE_URL);
try {
  const [target] = await db.select().from(user).where(eq(user.email, email));
  if (!target?.active || target.role !== "admin") throw new Error("An active administrator with that email was not found.");
  const recovery = await issueRecovery(db, target.id);
  privateWrite(resolve(".local/recovery-link.txt"), `${localConfig().origin}/reset#token=${recovery.token}\n`);
  console.log("A private, single-use 15-minute link is saved in .local/recovery-link.txt. Open it locally; do not publish or log it.");
} finally { await pool.end(); }
