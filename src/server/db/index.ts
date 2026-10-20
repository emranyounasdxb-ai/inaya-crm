import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

export function connectDatabase(connectionString: string, searchPath?: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    ...(searchPath ? { options: `-c search_path=${searchPath}` } : {}),
  });
  return { pool, db: drizzle(pool, { schema }) };
}
export type Database = ReturnType<typeof connectDatabase>["db"];
