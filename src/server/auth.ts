import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import type { Database } from "./db/index.ts";
import * as schema from "./db/schema.ts";

export function createAuth(db: Database, origin: string, secret: string) {
  if (secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters.");
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    baseURL: origin,
    secret,
    trustedOrigins: [origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "staff", input: false },
        active: { type: "boolean", defaultValue: true, input: false },
        language: { type: "string", defaultValue: "en", input: false },
      },
    },
    session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 60, cookieCache: { enabled: false } },
    advanced: {
      useSecureCookies: origin.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (value) => {
            const [member] = await db
              .select({ active: schema.user.active })
              .from(schema.user)
              .where(eq(schema.user.id, value.userId));
            if (!member?.active) return false;
          },
        },
      },
    },
  });
}
