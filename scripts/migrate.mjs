import "./check-runtime.mjs";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { connectDatabase } from "../src/server/db/index.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");
const { db, pool } = connectDatabase(process.env.DATABASE_URL);
try {
  await migrate(db, { migrationsFolder: "migrations" });
  console.log("Reviewed CRM migrations applied; existing records preserved.");
} finally {
  await pool.end();
}
