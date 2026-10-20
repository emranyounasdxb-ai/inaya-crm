import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Member, Role } from "../../shared/contracts.ts";
import type { Database } from "../db/index.ts";
import { account, activities, leads, passwordRecovery, session, user } from "../db/schema.ts";
import { AppError, allow } from "./leads.ts";

const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export async function checkPassword(db: Database, userId: string, password: string) {
  const [credential] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  if (!credential?.password || !(await verifyPassword({ hash: credential.password, password })))
    throw new AppError(403, "incorrect_password");
}

// Operator calls require local OS/database access. HTTP calls always supply an authenticated admin.
export async function issueRecovery(db: Database, targetId: string, actor?: Member) {
  if (actor) allow(actor, ["admin"]);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(74321981)`);
    if (actor) {
      const [fresh] = await tx.select().from(user).where(eq(user.id, actor.id));
      if (!fresh?.active || fresh.role !== "admin") throw new AppError(403, "forbidden");
    }
    const [target] = await tx.select().from(user).where(eq(user.id, targetId)).for("update");
    if (!target?.active) throw new AppError(400, "inactive_account");
    await tx.delete(passwordRecovery).where(eq(passwordRecovery.userId, targetId));
    await tx
      .insert(passwordRecovery)
      .values({ tokenHash: digest(token), userId: targetId, expiresAt });
    await tx.insert(activities).values({
      id: randomUUID(),
      actorId: actor?.id ?? targetId,
      kind: "recovery_issued",
      detail: { userId: targetId, via: actor ? "administrator" : "local_operator" },
    });
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function completeRecovery(db: Database, token: string, newPassword: string) {
  const tokenHash = digest(token);
  // Do not spend password hashing work on arbitrary/expired tokens.
  const [candidate] = await db
    .select()
    .from(passwordRecovery)
    .where(eq(passwordRecovery.tokenHash, tokenHash));
  if (!candidate || candidate.expiresAt.getTime() <= Date.now())
    throw new AppError(400, "invalid_recovery");
  const password = await hashPassword(newPassword);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(74321981)`);
    const [target] = await tx
      .select()
      .from(user)
      .where(eq(user.id, candidate.userId))
      .for("update");
    const [valid] = await tx
      .select()
      .from(passwordRecovery)
      .where(eq(passwordRecovery.tokenHash, tokenHash))
      .for("update");
    if (!target?.active || !valid || valid.expiresAt.getTime() <= Date.now())
      throw new AppError(400, "invalid_recovery");
    const changed = await tx
      .update(account)
      .set({ password, updatedAt: new Date() })
      .where(and(eq(account.userId, target.id), eq(account.providerId, "credential")))
      .returning({ id: account.id });
    if (changed.length !== 1) throw new AppError(400, "invalid_recovery");
    await tx.delete(session).where(eq(session.userId, target.id));
    await tx.delete(passwordRecovery).where(eq(passwordRecovery.userId, target.id));
    await tx
      .insert(activities)
      .values({ id: randomUUID(), actorId: target.id, kind: "password_recovered", detail: {} });
    return { ok: true };
  });
}

export async function changeRole(db: Database, actor: Member, id: string, role: Role) {
  allow(actor, ["admin"]);
  if (id === actor.id) throw new AppError(400, "cannot_change_self");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(74321981)`);
    const [fresh] = await tx.select().from(user).where(eq(user.id, actor.id));
    if (!fresh?.active || fresh.role !== "admin") throw new AppError(403, "forbidden");
    const [target] = await tx.select().from(user).where(eq(user.id, id)).for("update");
    if (!target) throw new AppError(404, "not_found");
    const [assigned] = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.assigneeId, id), sql`${leads.status} not in ('converted','lost')`))
      .limit(1);
    if (target.role === "staff" && role !== "staff" && assigned)
      throw new AppError(400, "reassign_first");
    await tx.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, id));
    await tx.delete(session).where(eq(session.userId, id));
    await tx.delete(passwordRecovery).where(eq(passwordRecovery.userId, id));
    await tx.insert(activities).values({
      id: randomUUID(),
      actorId: actor.id,
      kind: "role_changed",
      detail: { userId: id, before: target.role, after: role },
    });
    return { ok: true };
  });
}
