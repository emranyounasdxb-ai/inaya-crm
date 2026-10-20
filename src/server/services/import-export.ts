import { randomUUID } from "node:crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import Papa from "papaparse";
import { z } from "zod";
import { leadInput, type listInput, type Member } from "../../shared/contracts.ts";
import type { Database } from "../db/index.ts";
import { activities, importBatches, leads, user } from "../db/schema.ts";
import { AppError, allow, createLead, leadListWhere } from "./leads.ts";

export const importPreviewInput = z
  .object({
    rows: z
      .array(
        z
          .object({
            customerName: z.string().max(10000),
            phone: z.string().max(1000),
            source: z.string().max(1000),
            requirement: z.string().max(10000),
            createdAt: z.string().max(100).default(""),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();
type ImportRow = {
  row: number;
  customerName: string;
  phone: string;
  source: string;
  requirement: string;
  createdAt: string;
  errors: string[];
  duplicate: boolean;
};
export async function previewImport(
  db: Database,
  actor: Member,
  input: z.infer<typeof importPreviewInput>,
) {
  allow(actor, ["manager"]);
  const seen = new Set<string>();
  const rows: ImportRow[] = input.rows.map((raw, index) => {
    const parsed = leadInput.safeParse({
      customerName: raw.customerName,
      phone: raw.phone.replace(/^'(?=\+)/, ""),
      source: raw.source.trim().toLowerCase(),
      requirement: raw.requirement,
    });
    const phone = parsePhoneNumberFromString(raw.phone.replace(/^'(?=\+)/, ""), "AE");
    const date = raw.createdAt.trim();
    const iso = date
      ? /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? `${date}T00:00:00+04:00`
        : date
      : new Date().toISOString();
    const validDate =
      z.iso.datetime({ offset: true }).safeParse(iso).success &&
      Number.isFinite(new Date(iso).getTime()) &&
      new Date(iso).getTime() <= Date.now() &&
      new Date(iso).getFullYear() >= 1900;
    const errors = parsed.success
      ? []
      : [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    if (!phone?.isValid()) errors.push("phone");
    if (!validDate) errors.push("createdAt");
    const number = phone?.isValid() ? phone.number : raw.phone;
    const duplicate = seen.has(number);
    seen.add(number);
    return {
      row: index + 2,
      customerName: raw.customerName.trim(),
      phone: number,
      source: raw.source.trim().toLowerCase(),
      requirement: raw.requirement.trim(),
      createdAt: validDate ? new Date(iso).toISOString() : date,
      errors: [...new Set(errors)],
      duplicate,
    };
  });
  const existing = await db
    .select({ phone: leads.phone })
    .from(leads)
    .where(inArray(leads.phone, [...seen]));
  const existingPhones = new Set(existing.map((r) => r.phone));
  for (const row of rows) row.duplicate ||= existingPhones.has(row.phone);
  const id = randomUUID();
  await db
    .delete(importBatches)
    .where(
      and(
        eq(importBatches.userId, actor.id),
        lt(importBatches.createdAt, new Date(Date.now() - 7 * 86400000)),
      ),
    );
  await db
    .insert(importBatches)
    .values({ id, userId: actor.id, rows, expiresAt: new Date(Date.now() + 30 * 60000) });
  return { id, rows };
}
export const importCommitInput = z
  .object({
    id: z.uuid(),
    selected: z
      .array(
        z
          .object({ row: z.number().int().min(2).max(501), acknowledgeDuplicate: z.boolean() })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();
export async function commitImport(
  db: Database,
  actor: Member,
  input: z.infer<typeof importCommitInput>,
) {
  allow(actor, ["manager"]);
  return db.transaction(async (tx) => {
    const [batch] = await tx
      .select()
      .from(importBatches)
      .where(and(eq(importBatches.id, input.id), eq(importBatches.userId, actor.id)))
      .for("update");
    if (!batch) throw new AppError(400, "import_stale");
    if (batch.result) return batch.result; // Safe retry after a lost response; never double-import.
    if (batch.expiresAt.getTime() <= Date.now()) throw new AppError(400, "import_stale");
    const rows = batch.rows as ImportRow[];
    const choices = new Map(input.selected.map((s) => [s.row, s]));
    if (
      choices.size !== input.selected.length ||
      input.selected.some((s) => !rows.some((r) => r.row === s.row && !r.errors.length))
    )
      throw new AppError(400, "invalid_import");
    const ids: string[] = [];
    // Stable lock order avoids deadlocks between two simultaneous bulk imports.
    for (const row of rows
      .filter((r) => choices.has(r.row))
      .sort((a, b) => a.phone.localeCompare(b.phone))) {
      const selected = choices.get(row.row);
      if (!selected) throw new AppError(400, "invalid_import");
      const result = await createLead(
        tx as unknown as Database,
        actor,
        leadInput.parse({
          customerName: row.customerName,
          phone: row.phone,
          source: row.source,
          requirement: row.requirement,
          acknowledgeDuplicate: selected.acknowledgeDuplicate,
        }),
      );
      await tx
        .update(leads)
        .set({ createdAt: new Date(row.createdAt), ingestionKey: `${batch.id}:${row.row}` })
        .where(eq(leads.id, result.id));
      ids.push(result.id);
    }
    const result = { imported: ids.length, skipped: rows.length - ids.length };
    await tx.update(importBatches).set({ result }).where(eq(importBatches.id, batch.id));
    await tx.insert(activities).values({
      id: randomUUID(),
      actorId: actor.id,
      kind: "leads_imported",
      detail: { batchId: batch.id, ...result },
    });
    return result;
  });
}
export async function exportLeads(db: Database, actor: Member, input: z.infer<typeof listInput>) {
  allow(actor, ["owner", "admin"]);
  const rows = await db
    .select({
      id: leads.id,
      customerName: leads.customerName,
      phone: leads.phone,
      source: leads.source,
      requirement: leads.requirement,
      status: leads.status,
      assignee: user.name,
      createdAt: leads.createdAt,
      nextFollowUpAt: leads.nextFollowUpAt,
      convertedAt: leads.convertedAt,
      lostReason: leads.lostReason,
      archivedAt: leads.archivedAt,
    })
    .from(leads)
    .leftJoin(user, eq(leads.assigneeId, user.id))
    .where(leadListWhere(actor, input))
    .orderBy(leads.createdAt, leads.id)
    .limit(10001);
  if (rows.length > 10000) throw new AppError(400, "export_limit");
  const fields = [
    "id",
    "customerName",
    "phone",
    "source",
    "requirement",
    "status",
    "assignee",
    "createdAt",
    "nextFollowUpAt",
    "convertedAt",
    "lostReason",
    "archivedAt",
  ];
  const data = rows.map((row) =>
    fields.map((field) => {
      const value = row[field as keyof typeof row];
      return value instanceof Date ? value.toISOString() : (value ?? "");
    }),
  );
  await db.insert(activities).values({
    id: randomUUID(),
    actorId: actor.id,
    kind: "leads_exported",
    detail: { count: rows.length, filters: input },
  });
  return `\uFEFF${Papa.unparse({ fields, data }, { escapeFormulae: /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/, newline: "\r\n" })}`;
}
