import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { z } from "zod";
import type {
  archiveInput,
  assignmentInput,
  editLeadInput,
  leadInput,
  listInput,
  Member,
  updateInput,
} from "../../shared/contracts.ts";
import type { Database } from "../db/index.ts";
import { activities, comments, leads, notifications, user } from "../db/schema.ts";

export class AppError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
export const isClosed = (status: string) => status === "converted" || status === "lost";
export const scopeFor = (actor: Member) =>
  actor.role === "staff"
    ? and(eq(leads.assigneeId, actor.id), isNull(leads.archivedAt))
    : undefined;
export function allow(actor: Member, roles: Member["role"][]) {
  if (!roles.includes(actor.role)) throw new AppError(403, "forbidden");
}
const leadFields = {
  id: leads.id,
  customerName: leads.customerName,
  phone: leads.phone,
  source: leads.source,
  requirement: leads.requirement,
  status: leads.status,
  assigneeId: leads.assigneeId,
  assigneeName: user.name,
  nextFollowUpAt: leads.nextFollowUpAt,
  lostReason: leads.lostReason,
  lostExplanation: leads.lostExplanation,
  version: leads.version,
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
  sourceRevision: leads.sourceRevision,
  archivedAt: leads.archivedAt,
  archiveReason: leads.archiveReason,
};
export function dubaiDay(now = new Date()) {
  const day = new Date(now.getTime() + 4 * 3600000).toISOString().slice(0, 10);
  return {
    start: new Date(`${day}T00:00:00+04:00`),
    end: new Date(new Date(`${day}T00:00:00+04:00`).getTime() + 86400000),
  };
}
export function leadListWhere(actor: Member, input: z.infer<typeof listInput>) {
  const now = new Date();
  const { start, end } = dubaiDay(now);
  const escaped = input.q.replace(/[\\%_]/g, "\\$&");
  return and(
    scopeFor(actor),
    input.archived === "yes" ? isNotNull(leads.archivedAt) : isNull(leads.archivedAt),
    input.q
      ? or(ilike(leads.customerName, `%${escaped}%`), ilike(leads.phone, `%${escaped}%`))
      : undefined,
    input.status ? eq(leads.status, input.status) : undefined,
    input.source ? eq(leads.source, input.source) : undefined,
    input.assignee ? eq(leads.assigneeId, input.assignee) : undefined,
    input.due === "unassigned" ? isNull(leads.assigneeId) : undefined,
    input.due === "overdue" ? lt(leads.nextFollowUpAt, now) : undefined,
    input.due === "today"
      ? and(gte(leads.nextFollowUpAt, start), lt(leads.nextFollowUpAt, end))
      : undefined,
  );
}
export async function listLeads(db: Database, actor: Member, input: z.infer<typeof listInput>) {
  const where = leadListWhere(actor, input);
  const [items, totals] = await Promise.all([
    db
      .select(leadFields)
      .from(leads)
      .leftJoin(user, eq(leads.assigneeId, user.id))
      .where(where)
      .orderBy(desc(leads.createdAt), desc(leads.id))
      .limit(25)
      .offset((input.page - 1) * 25),
    db.select({ total: count() }).from(leads).where(where),
  ]);
  return { items, total: totals[0].total, page: input.page, pageSize: 25 };
}
export async function getLead(db: Database, actor: Member, id: string) {
  // One repeatable-read snapshot prevents an assignment change exposing comments
  // fetched after a staff member's initial access check.
  return db.transaction(
    async (tx) => {
      const [lead] = await tx
        .select(leadFields)
        .from(leads)
        .leftJoin(user, eq(leads.assigneeId, user.id))
        .where(and(eq(leads.id, id), scopeFor(actor)));
      if (!lead) throw new AppError(404, "not_found");
      const leadComments = await tx
        .select({
          id: comments.id,
          body: comments.body,
          authorName: user.name,
          authorId: comments.authorId,
          sourceRevision: comments.sourceRevision,
          createdAt: comments.createdAt,
        })
        .from(comments)
        .innerJoin(user, eq(user.id, comments.authorId))
        .where(eq(comments.leadId, id))
        .orderBy(asc(comments.createdAt));
      const leadActivities = await tx
        .select({
          id: activities.id,
          kind: activities.kind,
          detail: activities.detail,
          actorName: user.name,
          createdAt: activities.createdAt,
        })
        .from(activities)
        .innerJoin(user, eq(user.id, activities.actorId))
        .where(eq(activities.leadId, id))
        .orderBy(desc(activities.createdAt));
      return { ...lead, comments: leadComments, activities: leadActivities };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function createLead(db: Database, actor: Member, input: z.infer<typeof leadInput>) {
  allow(actor, ["manager"]);
  const phone = parsePhoneNumberFromString(input.phone, "AE");
  if (!phone?.isValid()) throw new AppError(400, "invalid_phone");
  return db.transaction(async (tx) => {
    // Serialize duplicate checks on the normalized number, including parallel tabs.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${phone.number}))`);
    const [duplicate] = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.phone, phone.number))
      .limit(1);
    if (duplicate && !input.acknowledgeDuplicate) throw new AppError(409, "duplicate_phone");
    const id = randomUUID();
    await tx.insert(leads).values({
      id,
      customerName: input.customerName,
      phone: phone.number,
      source: input.source,
      requirement: input.requirement,
      createdBy: actor.id,
    });
    await tx.insert(activities).values({
      id: randomUUID(),
      leadId: id,
      actorId: actor.id,
      kind: "created",
      detail: { duplicateAcknowledged: Boolean(duplicate) },
    });
    return { id };
  });
}
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
async function lockedLead(
  tx: Transaction,
  actor: Member,
  id: string,
  version?: number,
  allowArchived = false,
) {
  const [lead] = await tx
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), scopeFor(actor)))
    .for("update");
  if (!lead) throw new AppError(404, "not_found");
  if (version !== undefined && lead.version !== version) throw new AppError(409, "stale_lead");
  if (lead.archivedAt && !allowArchived) throw new AppError(400, "archived_lead");
  return lead;
}
function futureFollowUp(value: string) {
  const next = new Date(value);
  if (next.getTime() <= Date.now()) throw new AppError(400, "follow_up_future");
  return next;
}
export async function assignLead(
  db: Database,
  actor: Member,
  id: string,
  input: z.infer<typeof assignmentInput>,
) {
  allow(actor, ["manager"]);
  const nextFollowUpAt = futureFollowUp(input.nextFollowUpAt);
  return db.transaction(async (tx) => {
    const lead = await lockedLead(tx, actor, id, input.version);
    if (isClosed(lead.status)) throw new AppError(400, "closed_lead");
    const [assignee] = await tx
      .select()
      .from(user)
      .where(eq(user.id, input.assigneeId))
      .for("share");
    if (!assignee?.active || assignee.role !== "staff") throw new AppError(400, "invalid_assignee");
    await tx
      .update(leads)
      .set({
        assigneeId: assignee.id,
        nextFollowUpAt,
        updatedAt: new Date(),
        version: lead.version + 1,
      })
      .where(eq(leads.id, id));
    await tx.insert(activities).values({
      id: randomUUID(),
      leadId: id,
      actorId: actor.id,
      kind: "assigned",
      detail: {
        previousAssigneeId: lead.assigneeId,
        assigneeId: assignee.id,
        assigneeName: assignee.name,
        nextFollowUpAt: nextFollowUpAt.toISOString(),
      },
    });
    await tx.insert(notifications).values({ id: randomUUID(), leadId: id, userId: assignee.id });
    return { ok: true };
  });
}
export async function updateLead(
  db: Database,
  actor: Member,
  id: string,
  input: z.infer<typeof updateInput>,
) {
  allow(actor, ["manager", "staff"]);
  return db.transaction(async (tx) => {
    const lead = await lockedLead(tx, actor, id, input.version);
    if (isClosed(lead.status) && input.status !== lead.status) {
      if (actor.role !== "manager") throw new AppError(403, "manager_reopen");
      if (!input.reopenReason || isClosed(input.status)) throw new AppError(400, "reopen_reason");
    }
    if (isClosed(lead.status) && input.status === lead.status)
      throw new AppError(400, "closed_lead");
    if (!lead.assigneeId && !isClosed(input.status)) throw new AppError(400, "assign_first");
    if (
      input.status === "lost" &&
      (!input.lostReason || (input.lostReason === "other" && !input.lostExplanation))
    )
      throw new AppError(400, "lost_reason");
    const nextFollowUpAt = isClosed(input.status)
      ? null
      : input.nextFollowUpAt
        ? futureFollowUp(input.nextFollowUpAt)
        : null;
    if (!isClosed(input.status) && !nextFollowUpAt) throw new AppError(400, "follow_up_required");
    await tx
      .update(leads)
      .set({
        status: input.status,
        nextFollowUpAt,
        updatedAt: new Date(),
        version: lead.version + 1,
        lostReason: input.status === "lost" ? input.lostReason : null,
        lostExplanation: input.status === "lost" ? input.lostExplanation : "",
        // First booking confirmation is immutable, so reopening cannot inflate results.
        ...(input.status === "converted" && !lead.convertedAt
          ? { convertedAt: new Date(), convertedByAssigneeId: lead.assigneeId }
          : {}),
      })
      .where(eq(leads.id, id));
    await tx.insert(activities).values({
      id: randomUUID(),
      leadId: id,
      actorId: actor.id,
      kind: isClosed(lead.status) ? "reopened" : "updated",
      detail: {
        previousStatus: lead.status,
        status: input.status,
        nextFollowUpAt: nextFollowUpAt?.toISOString() ?? null,
        lostReason: input.lostReason,
        reason: input.reopenReason || input.lostExplanation,
      },
    });
    return { ok: true };
  });
}
export async function addComment(db: Database, actor: Member, id: string, body: string) {
  allow(actor, ["manager", "staff"]);
  return db.transaction(async (tx) => {
    await lockedLead(tx, actor, id);
    await tx.insert(comments).values({ id: randomUUID(), leadId: id, authorId: actor.id, body });
    return { ok: true };
  });
}
export async function dashboard(db: Database, actor: Member) {
  const { start, end } = dubaiDay();
  const [result] = await db
    .select({
      total: count(),
      unassigned:
        sql<number>`count(*) filter (where ${leads.assigneeId} is null and ${leads.status} not in ('converted','lost'))`.mapWith(
          Number,
        ),
      overdue: sql<number>`count(*) filter (where ${leads.nextFollowUpAt} < now())`.mapWith(Number),
      today:
        sql<number>`count(*) filter (where ${leads.nextFollowUpAt} >= ${start} and ${leads.nextFollowUpAt} < ${end})`.mapWith(
          Number,
        ),
      converted: sql<number>`count(*) filter (where ${leads.status} = 'converted')`.mapWith(Number),
      lost: sql<number>`count(*) filter (where ${leads.status} = 'lost')`.mapWith(Number),
    })
    .from(leads)
    .where(and(scopeFor(actor), isNull(leads.archivedAt)));
  return result;
}

export async function editLead(
  db: Database,
  actor: Member,
  id: string,
  input: z.infer<typeof editLeadInput>,
) {
  allow(actor, ["manager"]);
  const phone = parsePhoneNumberFromString(input.phone, "AE");
  if (!phone?.isValid()) throw new AppError(400, "invalid_phone");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${phone.number}))`);
    const lead = await lockedLead(tx, actor, id, input.version);
    const [duplicate] = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.phone, phone.number), ne(leads.id, id)))
      .limit(1);
    if (phone.number !== lead.phone && duplicate && !input.acknowledgeDuplicate)
      throw new AppError(409, "duplicate_phone");
    const before = {
      customerName: lead.customerName,
      phone: lead.phone,
      source: lead.source,
      requirement: lead.requirement,
    };
    const after = {
      customerName: input.customerName,
      phone: phone.number,
      source: input.source,
      requirement: input.requirement,
    };
    await tx
      .update(leads)
      .set({
        ...after,
        version: lead.version + 1,
        updatedAt: new Date(),
        sourceRevision: lead.sourceRevision + (lead.requirement !== input.requirement ? 1 : 0),
      })
      .where(eq(leads.id, id));
    await tx.insert(activities).values({
      id: randomUUID(),
      leadId: id,
      actorId: actor.id,
      kind: "details_edited",
      detail: { before, after, reason: input.reason },
    });
    return { ok: true };
  });
}

export async function archiveLead(
  db: Database,
  actor: Member,
  id: string,
  input: z.infer<typeof archiveInput>,
) {
  allow(actor, ["manager"]);
  return db.transaction(async (tx) => {
    const lead = await lockedLead(tx, actor, id, input.version, true);
    if (Boolean(lead.archivedAt) === input.archived) throw new AppError(409, "stale_lead");
    let nextFollowUpAt = lead.nextFollowUpAt;
    if (!input.archived && lead.assigneeId && !isClosed(lead.status)) {
      const [assignee] = await tx
        .select()
        .from(user)
        .where(eq(user.id, lead.assigneeId))
        .for("share");
      if (!assignee?.active || assignee.role !== "staff")
        throw new AppError(400, "invalid_assignee");
      if (!input.nextFollowUpAt) throw new AppError(400, "follow_up_required");
      nextFollowUpAt = futureFollowUp(input.nextFollowUpAt);
    }
    await tx
      .update(leads)
      .set({
        archivedAt: input.archived ? new Date() : null,
        archivedBy: input.archived ? actor.id : null,
        archiveReason: input.archived ? input.reason : null,
        nextFollowUpAt,
        version: lead.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id));
    await tx.insert(activities).values({
      id: randomUUID(),
      leadId: id,
      actorId: actor.id,
      kind: input.archived ? "archived" : "restored",
      detail: { reason: input.reason },
    });
    return { ok: true };
  });
}

export async function editComment(
  db: Database,
  actor: Member,
  leadId: string,
  commentId: string,
  body: string,
  revision: number,
) {
  allow(actor, ["manager", "staff"]);
  return db.transaction(async (tx) => {
    await lockedLead(tx, actor, leadId);
    const [comment] = await tx
      .select()
      .from(comments)
      .where(and(eq(comments.id, commentId), eq(comments.leadId, leadId)))
      .for("update");
    if (!comment) throw new AppError(404, "not_found");
    if (comment.authorId !== actor.id) throw new AppError(403, "forbidden");
    if (comment.sourceRevision !== revision) throw new AppError(409, "stale_lead");
    await tx
      .update(comments)
      .set({ body, sourceRevision: revision + 1 })
      .where(eq(comments.id, commentId));
    await tx.insert(activities).values({
      id: randomUUID(),
      leadId,
      actorId: actor.id,
      kind: "comment_edited",
      detail: {
        commentId,
        previousRevision: revision,
        before: { body: comment.body },
        after: { body },
      },
    });
    return { ok: true };
  });
}
