import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { lostReasons, roles, sources, statuses } from "../../shared/contracts.ts";

const time = (name: string) => timestamp(name, { withTimezone: true });
export const roleEnum = pgEnum("crm_role", roles);
export const statusEnum = pgEnum("lead_status", statuses);
export const sourceEnum = pgEnum("lead_source", sources);
export const lostReasonEnum = pgEnum("lost_reason", lostReasons);
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: roleEnum("role").notNull().default("staff"),
    active: boolean("active").notNull().default(true),
    language: text("language").notNull().default("en"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_email_lower_idx").on(sql`lower(${t.email})`),
    check("user_language_check", sql`${t.language} in ('en', 'ar')`),
  ],
);
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: time("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: time("access_token_expires_at"),
    refreshTokenExpiresAt: time("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("account_user_idx").on(t.userId),
    uniqueIndex("account_provider_idx").on(t.providerId, t.accountId),
  ],
);
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: time("expires_at").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    source: sourceEnum("source").notNull(),
    requirement: text("requirement").notNull().default(""),
    sourceRevision: integer("source_revision").notNull().default(1),
    status: statusEnum("status").notNull().default("new"),
    assigneeId: text("assignee_id").references(() => user.id),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    nextFollowUpAt: time("next_follow_up_at"),
    convertedAt: time("converted_at"),
    convertedByAssigneeId: text("converted_by_assignee_id").references(() => user.id),
    lostReason: lostReasonEnum("lost_reason"),
    lostExplanation: text("lost_explanation").notNull().default(""),
    version: integer("version").notNull().default(1),
    attribution: jsonb("attribution"),
    ingestionKey: text("ingestion_key").unique(),
    archivedAt: time("archived_at"),
    archivedBy: text("archived_by").references(() => user.id),
    archiveReason: text("archive_reason"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("leads_assignee_created_idx").on(t.assigneeId, t.createdAt),
    index("leads_follow_up_idx").on(t.nextFollowUpAt),
    index("leads_phone_idx").on(t.phone),
    index("leads_created_idx").on(t.createdAt),
    check(
      "active_assigned_follow_up",
      sql`${t.assigneeId} is null or ${t.status} in ('converted','lost') or ${t.nextFollowUpAt} is not null`,
    ),
    check(
      "closed_follow_up",
      sql`${t.status} not in ('converted','lost') or ${t.nextFollowUpAt} is null`,
    ),
    check(
      "lost_reason_required",
      sql`${t.status} <> 'lost' or (${t.lostReason} is not null and (${t.lostReason} <> 'other' or length(trim(${t.lostExplanation})) > 0))`,
    ),
  ],
);
export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    body: text("body").notNull(),
    sourceRevision: integer("source_revision").notNull().default(1),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("comments_lead_idx").on(t.leadId, t.createdAt)],
);
export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").references(() => leads.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    kind: text("kind").notNull(),
    detail: jsonb("detail").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("activities_lead_idx").on(t.leadId, t.createdAt)],
);
export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id),
    readAt: time("read_at"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);
export const passwordRecovery = pgTable("password_recovery", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: time("expires_at").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const importBatches = pgTable("import_batches", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  rows: jsonb("rows").notNull(),
  result: jsonb("result"),
  expiresAt: time("expires_at").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
});
