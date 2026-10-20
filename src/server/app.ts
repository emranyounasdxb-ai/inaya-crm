import { timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { fromNodeHeaders } from "better-auth/node";
import { and, count, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import Fastify from "fastify";
import { z } from "zod";
import type { Member } from "../shared/contracts.ts";
import {
  accountInput,
  archiveInput,
  assignmentInput,
  commentInput,
  editLeadInput,
  languageSchema,
  leadInput,
  listInput,
  roleSchema,
  updateInput,
} from "../shared/contracts.ts";
import { createAuth } from "./auth.ts";
import type { Database } from "./db/index.ts";
import { activities, leads, notifications, passwordRecovery, session, user } from "./db/schema.ts";
import { createIntegrationFoundation } from "./integrations/index.ts";
import { createAccount } from "./services/accounts.ts";
import {
  commitImport,
  exportLeads,
  importCommitInput,
  importPreviewInput,
  previewImport,
} from "./services/import-export.ts";
import {
  AppError,
  addComment,
  allow,
  archiveLead,
  assignLead,
  createLead,
  dashboard,
  editComment,
  editLead,
  getLead,
  listLeads,
  updateLead,
} from "./services/leads.ts";
import { changeRole, checkPassword, completeRecovery, issueRecovery } from "./services/recovery.ts";

declare module "fastify" {
  interface FastifyRequest {
    member: Member;
  }
}
export async function buildApp(options: {
  db: Database;
  origin: string;
  secret: string;
  bootstrapKey: string;
  serveWeb?: boolean;
  logger?: boolean;
  backupStatus?: () => {
    lastSuccess: string | null;
    lastRestore: string | null;
    lastAttemptFailed: boolean;
  };
}) {
  const { db, origin, bootstrapKey } = options;
  const auth = createAuth(db, origin, options.secret);
  const integrations = createIntegrationFoundation();
  const app = Fastify({
    logger: options.logger
      ? {
          redact: ["req.headers.cookie", "req.headers.authorization", "res.headers.set-cookie"],
          serializers: { req: (req) => ({ method: req.method, url: req.url?.split("?")[0] }) },
        }
      : false,
    bodyLimit: 32 * 1024,
    trustProxy: false,
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: origin.startsWith("https:") ? [] : null,
      },
    },
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    // Loading the UI/assets must not consume the API budget shared by office users.
    allowList: (request) => !request.url.startsWith("/api/"),
  });
  app.decorateRequest("member");
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({
        code: "invalid_input",
        fields: [...new Set(error.issues.map((issue) => String(issue.path[0] ?? "")))],
      });
    if (error instanceof AppError) return reply.code(error.status).send({ code: error.code });
    const pgCode =
      (error as { cause?: { code?: string }; code?: string }).cause?.code ??
      (error as { code?: string }).code;
    if (pgCode === "23505") return reply.code(409).send({ code: "already_exists" });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500)
      return reply.code(status).send({ code: status === 429 ? "rate_limited" : "invalid_input" });
    request.log.error(
      { errorType: error instanceof Error ? error.name : "unknown", requestId: request.id },
      "Request failed",
    );
    return reply.code(500).send({ code: "server_error" });
  });
  app.addHook("onRequest", async (req, reply) => {
    if (req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    // Same-origin JSON mutations, including login/bootstrap, reject absent and foreign origins.
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.headers.origin !== origin) throw new AppError(403, "origin_rejected");
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw new AppError(415, "json_required");
    }
  });
  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/setup", async () => {
    const [existing] = await db.select({ id: user.id }).from(user).limit(1);
    return { required: !existing };
  });
  app.post(
    "/api/setup",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const input = accountInput
        .omit({ role: true })
        .extend({ key: z.string().min(32).max(256) })
        .strict()
        .parse(req.body);
      const provided = Buffer.from(input.key);
      const expected = Buffer.from(bootstrapKey);
      if (
        !expected.length ||
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      )
        throw new AppError(403, "setup_key");
      // One setup can win, even if two different requests arrive together.
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(74321980)`);
        const [existing] = await tx.select({ id: user.id }).from(user).limit(1);
        if (existing) throw new AppError(409, "setup_complete");
        return createAccount(tx as unknown as Database, { ...input, role: "admin" });
      });
      return reply.code(201).send(result);
    },
  );
  const authPaths = new Set([
    "/api/auth/sign-in/email",
    "/api/auth/sign-out",
    "/api/auth/get-session",
    "/api/auth/change-password",
  ]);
  app.post(
    "/api/recovery/complete",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req) => {
      const input = z
        .object({
          token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
          newPassword: z.string().min(12).max(128),
        })
        .strict()
        .parse(req.body);
      return completeRecovery(db, input.token, input.newPassword);
    },
  );
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    config: { rateLimit: { max: 15, timeWindow: "1 minute" } },
    handler: async (req, reply) => {
      const path = req.url.split("?")[0];
      if (!authPaths.has(path)) throw new AppError(404, "not_found");
      const response = await auth.handler(
        new Request(new URL(req.url, origin), {
          method: req.method,
          headers: fromNodeHeaders(req.headers),
          ...(req.body ? { body: JSON.stringify(req.body) } : {}),
        }),
      );
      reply.code(response.status);
      response.headers.forEach((value, key) => {
        if (key !== "set-cookie") reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) reply.header("set-cookie", cookies);
      // Never send the session token in a JSON response; cookies are HttpOnly.
      const text = await response.text();
      if (response.headers.get("content-type")?.includes("application/json")) {
        const data = JSON.parse(text);
        if (data && typeof data === "object") {
          delete data.token;
          if (data.session) delete data.session.token;
        }
        return reply.send(data);
      }
      return reply.send(text);
    },
  });
  await app.register(async (privateApi) => {
    privateApi.addHook("preHandler", async (req) => {
      const found = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!found) throw new AppError(401, "unauthorized");
      const [member] = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          active: user.active,
          language: user.language,
        })
        .from(user)
        .where(eq(user.id, found.user.id));
      if (!member?.active) throw new AppError(401, "unauthorized");
      req.member = { ...member, language: languageSchema.parse(member.language) };
    });
    privateApi.get("/api/me", async (req) => req.member);
    privateApi.get("/api/backups/status", async (req) => {
      allow(req.member, ["owner", "admin"]);
      return (
        options.backupStatus?.() ?? {
          lastSuccess: null,
          lastRestore: null,
          lastAttemptFailed: false,
        }
      );
    });
    privateApi.patch("/api/me/language", async (req) => {
      const input = z.object({ language: languageSchema }).strict().parse(req.body);
      await db
        .update(user)
        .set({ language: input.language, updatedAt: new Date() })
        .where(eq(user.id, req.member.id));
      return input;
    });
    privateApi.get("/api/team", async (req) => {
      allow(req.member, ["admin", "owner", "manager"]);
      return db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          active: user.active,
          language: user.language,
        })
        .from(user)
        .orderBy(user.name);
    });
    privateApi.post("/api/team", async (req, reply) => {
      allow(req.member, ["admin"]);
      return reply
        .code(201)
        .send(await createAccount(db, accountInput.parse(req.body), req.member.id));
    });
    privateApi.patch("/api/team/:id/active", async (req) => {
      allow(req.member, ["admin"]);
      const { id } = z.object({ id: z.string().max(100) }).parse(req.params);
      const { active } = z.object({ active: z.boolean() }).strict().parse(req.body);
      if (id === req.member.id) throw new AppError(400, "cannot_deactivate_self");
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(74321981)`);
        const [fresh] = await tx.select().from(user).where(eq(user.id, req.member.id));
        if (!fresh?.active || fresh.role !== "admin") throw new AppError(403, "forbidden");
        const [target] = await tx.select().from(user).where(eq(user.id, id)).for("update");
        if (!target) throw new AppError(404, "not_found");
        await tx.update(user).set({ active, updatedAt: new Date() }).where(eq(user.id, id));
        if (!active) await tx.delete(session).where(eq(session.userId, id));
        if (!active) await tx.delete(passwordRecovery).where(eq(passwordRecovery.userId, id));
        await tx.insert(activities).values({
          id: crypto.randomUUID(),
          actorId: req.member.id,
          kind: active ? "account_activated" : "account_deactivated",
          detail: { userId: id },
        });
        return { ok: true };
      });
    });
    privateApi.patch("/api/team/:id/role", async (req) => {
      const { id } = z.object({ id: z.string().min(1).max(100) }).parse(req.params);
      const { role } = z.object({ role: roleSchema }).strict().parse(req.body);
      return changeRole(db, req.member, id, role);
    });
    privateApi.post(
      "/api/team/:id/recovery",
      { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
      async (req) => {
        allow(req.member, ["admin"]);
        const { id } = z.object({ id: z.string().min(1).max(100) }).parse(req.params);
        const { currentPassword } = z
          .object({ currentPassword: z.string().min(1).max(128) })
          .strict()
          .parse(req.body);
        await checkPassword(db, req.member.id, currentPassword);
        const result = await issueRecovery(db, id, req.member);
        return { url: `${origin}/reset#token=${result.token}`, expiresAt: result.expiresAt };
      },
    );
    privateApi.get("/api/dashboard", async (req) => dashboard(db, req.member));
    privateApi.post(
      "/api/import/preview",
      { bodyLimit: 3 * 1024 * 1024, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
      async (req) => previewImport(db, req.member, importPreviewInput.parse(req.body)),
    );
    privateApi.post(
      "/api/import/commit",
      { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
      async (req) => commitImport(db, req.member, importCommitInput.parse(req.body)),
    );
    privateApi.get(
      "/api/export/leads",
      { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
      async (req, reply) => {
        const csv = await exportLeads(db, req.member, listInput.parse(req.query));
        return reply
          .header("Content-Type", "text/csv; charset=utf-8")
          .header("Content-Disposition", 'attachment; filename="inaya-leads.csv"')
          .send(csv);
      },
    );
    privateApi.get("/api/leads", async (req) =>
      listLeads(db, req.member, listInput.parse(req.query)),
    );
    privateApi.post("/api/leads", async (req, reply) =>
      reply.code(201).send(await createLead(db, req.member, leadInput.parse(req.body))),
    );
    const idOf = (params: unknown) => z.object({ id: z.uuid() }).parse(params).id;
    privateApi.get("/api/leads/:id", async (req) => getLead(db, req.member, idOf(req.params)));
    privateApi.post("/api/leads/:id/assign", async (req) =>
      assignLead(db, req.member, idOf(req.params), assignmentInput.parse(req.body)),
    );
    privateApi.patch("/api/leads/:id", async (req) =>
      updateLead(db, req.member, idOf(req.params), updateInput.parse(req.body)),
    );
    privateApi.patch("/api/leads/:id/details", async (req) =>
      editLead(db, req.member, idOf(req.params), editLeadInput.parse(req.body)),
    );
    privateApi.post("/api/leads/:id/archive", async (req) =>
      archiveLead(db, req.member, idOf(req.params), archiveInput.parse(req.body)),
    );
    privateApi.patch("/api/leads/:id/comments/:commentId", async (req) => {
      const { id, commentId } = z.object({ id: z.uuid(), commentId: z.uuid() }).parse(req.params);
      const input = commentInput
        .extend({ revision: z.number().int().positive() })
        .strict()
        .parse(req.body);
      return editComment(db, req.member, id, commentId, input.body, input.revision);
    });
    privateApi.post("/api/leads/:id/comments", async (req, reply) =>
      reply
        .code(201)
        .send(
          await addComment(db, req.member, idOf(req.params), commentInput.parse(req.body).body),
        ),
    );
    privateApi.post("/api/leads/:id/translation", async (req) => {
      const lead = await getLead(db, req.member, idOf(req.params));
      const { language } = z.object({ language: languageSchema }).strict().parse(req.body);
      return integrations.translation.translate({
        record: {
          kind: "lead_requirement",
          id: lead.id,
          sourceRevision: String(lead.sourceRevision),
        },
        originalText: lead.requirement,
        sourceLanguage: "unknown",
        targetLanguage: language,
      });
    });
    privateApi.get("/api/notifications", async (req) => {
      const assigned = await db
        .select({
          id: notifications.id,
          leadId: leads.id,
          customerName: leads.customerName,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .innerJoin(leads, eq(leads.id, notifications.leadId))
        .where(
          and(
            eq(notifications.userId, req.member.id),
            eq(leads.assigneeId, req.member.id),
            isNull(notifications.readAt),
            isNull(leads.archivedAt),
          ),
        )
        .orderBy(desc(notifications.createdAt))
        .limit(50);
      const due = await db
        .select({
          id: leads.id,
          leadId: leads.id,
          customerName: leads.customerName,
          createdAt: leads.nextFollowUpAt,
        })
        .from(leads)
        .where(
          and(
            eq(leads.assigneeId, req.member.id),
            isNull(leads.archivedAt),
            lt(leads.nextFollowUpAt, new Date()),
          ),
        )
        .orderBy(leads.nextFollowUpAt)
        .limit(50);
      return [
        ...due.map((item) => ({ ...item, id: `due:${item.id}`, kind: "overdue" })),
        ...assigned.map((item) => ({ ...item, kind: "assigned" })),
      ];
    });
    privateApi.post("/api/notifications/read", async (req) => {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(eq(notifications.userId, req.member.id));
      return { ok: true };
    });
    privateApi.get("/api/reports", async (req) => {
      allow(req.member, ["owner", "admin", "manager"]);
      const input = listInput.extend({ from: z.iso.date(), to: z.iso.date() }).parse(req.query);
      if (input.to < input.from) throw new AppError(400, "date_range");
      const from = new Date(`${input.from}T00:00:00+04:00`);
      const to = new Date(new Date(`${input.to}T00:00:00+04:00`).getTime() + 86400000);
      const common = and(
        isNull(leads.archivedAt),
        input.source ? eq(leads.source, input.source) : undefined,
        input.status ? eq(leads.status, input.status) : undefined,
      );
      const created = and(
        common,
        gte(leads.createdAt, from),
        lt(leads.createdAt, to),
        input.assignee ? eq(leads.assigneeId, input.assignee) : undefined,
      );
      const converted = and(
        common,
        gte(leads.convertedAt, from),
        lt(leads.convertedAt, to),
        input.assignee ? eq(leads.convertedByAssigneeId, input.assignee) : undefined,
      );
      const [newBySource, convertedBySource, newByStaff, convertedByStaff, lostByReason] =
        await Promise.all([
          db
            .select({ key: leads.source, total: count() })
            .from(leads)
            .where(created)
            .groupBy(leads.source),
          db
            .select({ key: leads.source, total: count() })
            .from(leads)
            .where(converted)
            .groupBy(leads.source),
          db
            .select({ key: leads.assigneeId, name: user.name, total: count() })
            .from(leads)
            .leftJoin(user, eq(user.id, leads.assigneeId))
            .where(created)
            .groupBy(leads.assigneeId, user.name),
          db
            .select({ key: leads.convertedByAssigneeId, name: user.name, total: count() })
            .from(leads)
            .leftJoin(user, eq(user.id, leads.convertedByAssigneeId))
            .where(converted)
            .groupBy(leads.convertedByAssigneeId, user.name),
          db
            .select({ key: leads.lostReason, total: count() })
            .from(leads)
            .where(and(created, eq(leads.status, "lost")))
            .groupBy(leads.lostReason),
        ]);
      return { newBySource, convertedBySource, newByStaff, convertedByStaff, lostByReason };
    });
  });
  if (options.serveWeb) {
    await app.register(fastifyStatic, { root: resolve("dist/web"), wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/") || req.url.startsWith("/assets/") || req.method !== "GET")
        return reply.code(404).send({ code: "not_found" });
      return reply.sendFile("index.html", { cacheControl: false });
    });
  }
  return app;
}
