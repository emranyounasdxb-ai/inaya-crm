import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { buildApp } from "../src/server/app.ts";
import { createAccount } from "../src/server/services/accounts.ts";
import { dubaiDay } from "../src/server/services/leads.ts";
import { testDatabase } from "./database.mjs";

const origin = "http://127.0.0.1:4310";
const password = randomBytes(20).toString("base64url");
const bootstrapKey = randomBytes(32).toString("base64url");
let fixture;
let app;
const members = {};
const cookies = {};
let leadId;
const due = () => new Date(Date.now() + 86400000).toISOString();
function request(role, method, url, payload, headers = {}) {
  return app.inject({
    method,
    url,
    headers: {
      ...(role ? { cookie: cookies[role] } : {}),
      ...(method !== "GET" ? { origin, "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(payload === undefined ? {} : { payload }),
  });
}
async function login(email) {
  const response = await request(null, "POST", "/api/auth/sign-in/email", { email, password });
  assert.equal(response.statusCode, 200, response.body);
  const cookie = response.cookies.map((entry) => `${entry.name}=${entry.value}`).join("; ");
  assert.ok(cookie);
  assert.equal(response.json().token, undefined);
  assert.ok(response.cookies.every((entry) => entry.httpOnly));
  return cookie;
}
before(async () => {
  fixture = await testDatabase();
  app = await buildApp({
    db: fixture.db,
    origin,
    secret: randomBytes(48).toString("base64url"),
    bootstrapKey,
  });
});
test("page loads do not consume API limits while password recovery still throttles", async () => {
  const limited = await buildApp({
    db: fixture.db,
    origin,
    secret: randomBytes(48).toString("base64url"),
    bootstrapKey: "",
  });
  try {
    for (let i = 0; i < 305; i++)
      assert.equal((await limited.inject({ method: "GET", url: "/" })).statusCode, 404);
    assert.equal((await limited.inject({ method: "GET", url: "/api/health" })).statusCode, 200);
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await limited.inject({
            method: "POST",
            url: "/api/recovery/complete",
            headers: { origin, "content-type": "application/json" },
            payload: { token: "x".repeat(43), newPassword: password },
          })
        ).statusCode,
        400,
      );
    assert.equal(
      (
        await limited.inject({
          method: "POST",
          url: "/api/recovery/complete",
          headers: { origin, "content-type": "application/json" },
          payload: { token: "x".repeat(43), newPassword: password },
        })
      ).statusCode,
      429,
    );
  } finally {
    await limited.close();
  }
});
after(async () => {
  await app?.close();
  await fixture?.cleanup();
});
test("first setup needs its private key; only one administrator can be created", async () => {
  assert.equal((await request(null, "GET", "/api/setup")).json().required, true);
  const input = { name: "Test Admin", email: "admin@example.test", password, key: "x".repeat(43) };
  assert.equal((await request(null, "POST", "/api/setup", input)).statusCode, 403);
  const response = await request(null, "POST", "/api/setup", { ...input, key: bootstrapKey });
  assert.equal(response.statusCode, 201, response.body);
  members.admin = response.json();
  assert.equal(
    (await request(null, "POST", "/api/setup", { ...input, key: bootstrapKey })).statusCode,
    409,
  );
  assert.equal((await request(null, "GET", "/api/setup")).json().required, false);
  for (const role of ["manager", "staff", "other", "owner"]) {
    members[role] = await createAccount(
      fixture.db,
      {
        name: `Test ${role}`,
        email: `${role}@example.test`,
        password,
        role: role === "other" ? "staff" : role,
      },
      members.admin.id,
    );
  }
  for (const role of Object.keys(members)) cookies[role] = await login(`${role}@example.test`);
});
test("anonymous requests, public signup and cross-origin mutations are denied", async () => {
  assert.equal((await request(null, "GET", "/api/leads")).statusCode, 401);
  assert.equal(
    (
      await request(null, "POST", "/api/auth/sign-up/email", {
        email: "intruder@example.test",
        password,
        name: "Intruder",
        role: "admin",
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await request(
        "admin",
        "POST",
        "/api/team",
        { name: "Bad", email: "bad@example.test", password, role: "admin" },
        { origin: "https://attacker.example" },
      )
    ).statusCode,
    403,
  );
  const noOrigin = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    headers: { "content-type": "application/json" },
    payload: { email: "admin@example.test", password },
  });
  assert.equal(noOrigin.statusCode, 403);
  assert.equal((await request("staff", "POST", "/api/team", {})).statusCode, 403);
  assert.equal(
    (await request("staff", "POST", "/api/auth/update-user", { role: "admin" })).statusCode,
    404,
  );
  const response = await request("staff", "GET", "/api/me");
  assert.equal(response.json().role, "staff");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.match(response.headers["content-security-policy"], /frame-ancestors 'none'/);
});
test("manager creates normalized leads; required fields and duplicates are enforced", async () => {
  const input = {
    customerName: "عميل اختبار",
    phone: "0501234567",
    source: "whatsapp",
    requirement: "<script>alert('x')</script> أحتاج عاملة منزلية",
  };
  assert.equal((await request("admin", "POST", "/api/leads", input)).statusCode, 403);
  assert.equal(
    (await request("manager", "POST", "/api/leads", { ...input, customerName: "" })).statusCode,
    400,
  );
  assert.equal(
    (await request("manager", "POST", "/api/leads", { ...input, phone: "123" })).statusCode,
    400,
  );
  const created = await request("manager", "POST", "/api/leads", input);
  assert.equal(created.statusCode, 201, created.body);
  leadId = created.json().id;
  const detail = (await request("manager", "GET", `/api/leads/${leadId}`)).json();
  assert.equal(detail.phone, "+971501234567");
  assert.equal(detail.status, "new");
  assert.equal(detail.assigneeId, null);
  assert.equal(detail.requirement, input.requirement);
  assert.equal(
    (await request("manager", "POST", "/api/leads", { ...input, phone: "+971 50 123 4567" })).json()
      .code,
    "duplicate_phone",
  );
  assert.equal(
    (await request("manager", "POST", "/api/leads", { ...input, acknowledgeDuplicate: true }))
      .statusCode,
    201,
  );
});
test("assignment grants only the chosen staff access to records, comments and translation", async () => {
  assert.equal((await request("staff", "GET", `/api/leads/${leadId}`)).statusCode, 404);
  assert.equal((await request("staff", "GET", "/api/leads")).json().total, 0);
  const assigned = await request("manager", "POST", `/api/leads/${leadId}/assign`, {
    version: 1,
    assigneeId: members.staff.id,
    nextFollowUpAt: due(),
  });
  assert.equal(assigned.statusCode, 200, assigned.body);
  assert.equal((await request("staff", "GET", "/api/leads")).json().total, 1);
  assert.equal(
    (await request("other", "GET", `/api/leads?assignee=${members.staff.id}`)).json().total,
    0,
  );
  assert.equal((await request("other", "GET", `/api/leads/${leadId}`)).statusCode, 404);
  assert.equal(
    (await request("other", "POST", `/api/leads/${leadId}/comments`, { body: "Unauthorized" }))
      .statusCode,
    404,
  );
  assert.equal(
    (await request("other", "POST", `/api/leads/${leadId}/translation`, { language: "ar" }))
      .statusCode,
    404,
  );
  assert.equal(
    (
      await request("staff", "POST", `/api/leads/${leadId}/assign`, {
        version: 2,
        assigneeId: members.other.id,
        nextFollowUpAt: due(),
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await request("staff", "POST", `/api/leads/${leadId}/comments`, {
        body: "تم الاتصال بالعميل",
      })
    ).statusCode,
    201,
  );
  assert.equal(
    (await request("staff", "POST", `/api/leads/${leadId}/translation`, { language: "en" })).json()
      .reason,
    "not_configured",
  );
  assert.equal((await request("staff", "GET", "/api/notifications")).json().length, 1);
});
test("status changes require a future follow-up or lost reason and reject stale writes", async () => {
  const input = { version: 2, status: "contacted", nextFollowUpAt: due() };
  assert.equal(
    (
      await request("staff", "PATCH", `/api/leads/${leadId}`, { ...input, nextFollowUpAt: null })
    ).json().code,
    "follow_up_required",
  );
  assert.equal(
    (await request("staff", "PATCH", `/api/leads/${leadId}`, { ...input, status: "lost" })).json()
      .code,
    "lost_reason",
  );
  assert.equal(
    (
      await request("staff", "PATCH", `/api/leads/${leadId}`, {
        ...input,
        status: "lost",
        lostReason: "other",
        lostExplanation: " ",
      })
    ).statusCode,
    400,
  );
  assert.equal((await request("staff", "PATCH", `/api/leads/${leadId}`, input)).statusCode, 200);
  assert.equal(
    (await request("staff", "PATCH", `/api/leads/${leadId}`, input)).json().code,
    "stale_lead",
  );
  const simultaneous = await Promise.all([
    request("staff", "PATCH", `/api/leads/${leadId}`, {
      ...input,
      version: 3,
      status: "interested",
    }),
    request("staff", "PATCH", `/api/leads/${leadId}`, {
      ...input,
      version: 3,
      status: "follow_up",
    }),
  ]);
  assert.deepEqual(simultaneous.map((response) => response.statusCode).sort(), [200, 409]);
});
test("reassignment immediately removes old staff access and preserves history", async () => {
  assert.equal(
    (
      await request("manager", "POST", `/api/leads/${leadId}/assign`, {
        version: 4,
        assigneeId: members.other.id,
        nextFollowUpAt: due(),
      })
    ).statusCode,
    200,
  );
  assert.equal((await request("staff", "GET", `/api/leads/${leadId}`)).statusCode, 404);
  assert.equal(
    (await request("staff", "POST", `/api/leads/${leadId}/comments`, { body: "Old staff" }))
      .statusCode,
    404,
  );
  assert.equal((await request("staff", "GET", "/api/notifications")).json().length, 0);
  const detail = (await request("other", "GET", `/api/leads/${leadId}`)).json();
  assert.equal(detail.comments[0].body, "تم الاتصال بالعميل");
  assert.equal(detail.activities.filter((entry) => entry.kind === "assigned").length, 2);
});
test("conversion closes reminders, reports preserve attribution across reopening", async () => {
  assert.equal(
    (
      await request("other", "PATCH", `/api/leads/${leadId}`, {
        version: 5,
        status: "converted",
        nextFollowUpAt: null,
      })
    ).statusCode,
    200,
  );
  let detail = (await request("other", "GET", `/api/leads/${leadId}`)).json();
  assert.equal(detail.nextFollowUpAt, null);
  assert.equal(
    (
      await request("other", "PATCH", `/api/leads/${leadId}`, {
        version: 6,
        status: "new",
        nextFollowUpAt: due(),
        reopenReason: "New information",
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await request("manager", "PATCH", `/api/leads/${leadId}`, {
        version: 6,
        status: "new",
        nextFollowUpAt: due(),
        reopenReason: "Customer asked to review",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await request("manager", "POST", `/api/leads/${leadId}/assign`, {
        version: 7,
        assigneeId: members.staff.id,
        nextFollowUpAt: due(),
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await request("staff", "PATCH", `/api/leads/${leadId}`, {
        version: 8,
        status: "converted",
        nextFollowUpAt: null,
      })
    ).statusCode,
    200,
  );
  const day = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
  const report = (await request("owner", "GET", `/api/reports?from=${day}&to=${day}`)).json();
  assert.deepEqual(
    report.convertedByStaff.map((row) => [row.key, row.total]),
    [[members.other.id, 1]],
  );
  assert.equal(
    (await request("staff", "GET", `/api/reports?from=${day}&to=${day}`)).statusCode,
    403,
  );
  detail = (await request("owner", "GET", `/api/leads/${leadId}`)).json();
  assert.equal(detail.status, "converted");
  assert.equal(detail.comments.length, 1);
});
test("user locales are independent and cannot overwrite source data or permissions", async () => {
  const before = (await request("owner", "GET", "/api/dashboard")).json();
  assert.equal(
    (await request("staff", "PATCH", "/api/me/language", { language: "ar" })).statusCode,
    200,
  );
  assert.equal((await request("staff", "GET", "/api/me")).json().language, "ar");
  assert.equal((await request("other", "GET", "/api/me")).json().language, "en");
  assert.equal(
    (await request("staff", "PATCH", "/api/me/language", { language: "en", role: "admin" }))
      .statusCode,
    400,
  );
  assert.deepEqual((await request("owner", "GET", "/api/dashboard")).json(), before);
  assert.equal(
    (await request("staff", "GET", `/api/leads/${leadId}`)).json().customerName,
    "عميل اختبار",
  );
});
test("overdue notifications remain until the lead is rescheduled or closed", async () => {
  const created = await request("manager", "POST", "/api/leads", {
    customerName: "Follow-up test",
    phone: "+971509876540",
    source: "call",
  });
  const id = created.json().id;
  assert.equal(
    (
      await request("manager", "POST", `/api/leads/${id}/assign`, {
        version: 1,
        assigneeId: members.staff.id,
        nextFollowUpAt: due(),
      })
    ).statusCode,
    200,
  );
  // Simulate time passing without waiting or changing the machine clock.
  await fixture.pool.query(
    "update leads set next_follow_up_at = now() - interval '1 minute' where id = $1",
    [id],
  );
  assert.ok(
    (await request("staff", "GET", "/api/notifications"))
      .json()
      .some((item) => item.id === `due:${id}`),
  );
  await request("staff", "POST", "/api/notifications/read", {});
  assert.ok(
    (await request("staff", "GET", "/api/notifications"))
      .json()
      .some((item) => item.id === `due:${id}`),
  );
  assert.equal(
    (
      await request("staff", "PATCH", `/api/leads/${id}`, {
        version: 2,
        status: "lost",
        nextFollowUpAt: null,
        lostReason: "other",
        lostExplanation: "Customer moved away",
      })
    ).statusCode,
    200,
  );
  assert.ok(
    !(await request("staff", "GET", "/api/notifications"))
      .json()
      .some((item) => item.id === `due:${id}`),
  );
  assert.equal((await request("staff", "GET", `/api/leads/${id}`)).json().nextFollowUpAt, null);
});
test("deactivating an account revokes its existing sessions and denies new login", async () => {
  assert.equal(
    (await request("admin", "PATCH", `/api/team/${members.admin.id}/active`, { active: false }))
      .statusCode,
    400,
  );
  assert.equal(
    (await request("admin", "PATCH", `/api/team/${members.staff.id}/active`, { active: false }))
      .statusCode,
    200,
  );
  assert.equal((await request("staff", "GET", "/api/leads")).statusCode, 401);
  const signIn = await request(null, "POST", "/api/auth/sign-in/email", {
    email: "staff@example.test",
    password,
  });
  assert.notEqual(signIn.statusCode, 200);
  assert.equal((await request("owner", "GET", `/api/leads/${leadId}`)).json().comments.length, 1);
  assert.equal(
    (await request("owner", "PATCH", `/api/team/${members.other.id}/active`, { active: false }))
      .statusCode,
    403,
  );
});
test("Dubai date boundaries and unknown APIs do not silently become successful app pages", async () => {
  const day = dubaiDay(new Date("2026-10-20T20:30:00Z"));
  assert.equal(day.start.toISOString(), "2026-10-20T20:00:00.000Z");
  assert.equal(day.end.toISOString(), "2026-10-21T20:00:00.000Z");
  assert.equal((await request("manager", "GET", `/api/leads/${randomUUID()}`)).statusCode, 404);
});

test("manager detail edits keep old values, normalize phones, reject stale and unauthorized edits", async () => {
  const lead = (await request("manager", "GET", `/api/leads/${leadId}`)).json();
  const input = {
    version: lead.version,
    customerName: "Edited customer عميل",
    phone: lead.phone,
    source: "referral",
    requirement: "Updated original",
    reason: "Customer correction",
  };
  assert.equal(
    (await request("owner", "PATCH", `/api/leads/${leadId}/details`, input)).statusCode,
    403,
  );
  assert.equal(
    (await request("manager", "PATCH", `/api/leads/${leadId}/details`, input)).statusCode,
    200,
  );
  assert.equal(
    (await request("manager", "PATCH", `/api/leads/${leadId}/details`, input)).statusCode,
    409,
  );
  const updated = (await request("manager", "GET", `/api/leads/${leadId}`)).json();
  assert.equal(updated.sourceRevision, lead.sourceRevision + 1);
  const activity = updated.activities.find((item) => item.kind === "details_edited");
  assert.equal(activity.detail.before.customerName, lead.customerName);
  assert.equal(activity.detail.after.customerName, input.customerName);
  assert.equal(updated.createdAt, lead.createdAt);
});

test("own-comment edits preserve old text and reject other authors and stale revisions", async () => {
  const fresh = await request("manager", "POST", "/api/leads", {
    customerName: "Completion workflow",
    phone: "+971509874322",
    source: "call",
    requirement: "",
  });
  assert.equal(fresh.statusCode, 201, fresh.body);
  leadId = fresh.json().id;
  assert.equal(
    (
      await request("manager", "POST", `/api/leads/${leadId}/assign`, {
        version: 1,
        assigneeId: members.other.id,
        nextFollowUpAt: due(),
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await request("manager", "POST", `/api/leads/${leadId}/comments`, { body: "Before edit" }))
      .statusCode,
    201,
  );
  const lead = (await request("manager", "GET", `/api/leads/${leadId}`)).json();
  const comment = lead.comments.find((item) => item.body === "Before edit");
  const path = `/api/leads/${leadId}/comments/${comment.id}`;
  assert.equal(
    (await request("other", "PATCH", path, { body: "Hijacked", revision: 1 })).statusCode,
    403,
  );
  assert.equal(
    (await request("manager", "PATCH", path, { body: "After edit", revision: 1 })).statusCode,
    200,
  );
  assert.equal(
    (await request("manager", "PATCH", path, { body: "Stale edit", revision: 1 })).statusCode,
    409,
  );
  const after = (await request("owner", "GET", `/api/leads/${leadId}`)).json();
  assert.equal(after.comments.find((item) => item.id === comment.id).sourceRevision, 2);
  assert.equal(
    after.activities.find((item) => item.kind === "comment_edited").detail.before.body,
    "Before edit",
  );
});

test("archive hides staff access, reminders and reporting; restore preserves history", async () => {
  const lead = (await request("manager", "GET", `/api/leads/${leadId}`)).json();
  const total = (await request("owner", "GET", "/api/dashboard")).json().total;
  assert.equal(
    (
      await request("manager", "POST", `/api/leads/${leadId}/archive`, {
        version: lead.version,
        archived: true,
        reason: "Review archive",
      })
    ).statusCode,
    200,
  );
  assert.equal((await request("other", "GET", `/api/leads/${leadId}`)).statusCode, 404);
  assert.equal((await request("owner", "GET", "/api/dashboard")).json().total, total - 1);
  assert.ok(
    (await request("manager", "GET", "/api/leads?archived=yes"))
      .json()
      .items.some((l) => l.id === leadId),
  );
  assert.equal(
    (await request("manager", "POST", `/api/leads/${leadId}/comments`, { body: "Blocked" })).json()
      .code,
    "archived_lead",
  );
  assert.equal(
    (
      await request("manager", "POST", `/api/leads/${leadId}/archive`, {
        version: lead.version + 1,
        archived: false,
        reason: "Back to work",
        nextFollowUpAt: due(),
      })
    ).statusCode,
    200,
  );
  assert.equal((await request("other", "GET", `/api/leads/${leadId}`)).statusCode, 200);
  assert.equal((await request("owner", "GET", "/api/dashboard")).json().total, total);
});

test("admin role changes prevent self-lockout and orphaned assignments and revoke sessions", async () => {
  assert.equal(
    (
      await request("admin", "PATCH", `/api/team/${members.admin.id}/role`, { role: "staff" })
    ).json().code,
    "cannot_change_self",
  );
  assert.equal(
    (
      await request("admin", "PATCH", `/api/team/${members.other.id}/role`, { role: "manager" })
    ).json().code,
    "reassign_first",
  );
  assert.equal(
    (await request("manager", "PATCH", `/api/team/${members.owner.id}/role`, { role: "admin" }))
      .statusCode,
    403,
  );
  assert.equal(
    (await request("admin", "PATCH", `/api/team/${members.owner.id}/role`, { role: "manager" }))
      .statusCode,
    200,
  );
  assert.equal((await request("owner", "GET", "/api/me")).statusCode, 401);
  assert.equal(
    (await request("admin", "PATCH", `/api/team/${members.owner.id}/role`, { role: "owner" }))
      .statusCode,
    200,
  );
  cookies.owner = await login("owner@example.test");
});

test("recovery verifies administrator, rejects expired/reused tokens and invalidates all old sessions", async () => {
  const path = `/api/team/${members.owner.id}/recovery`;
  assert.equal(
    (await request("manager", "POST", path, { currentPassword: password })).statusCode,
    403,
  );
  assert.equal(
    (await request("admin", "POST", path, { currentPassword: "incorrect" })).statusCode,
    403,
  );
  const issued = await request("admin", "POST", path, { currentPassword: password });
  assert.equal(issued.statusCode, 200, issued.body);
  const token = new URLSearchParams(new URL(issued.json().url).hash.slice(1)).get("token");
  const stored = (await fixture.pool.query("SELECT token_hash FROM password_recovery")).rows;
  assert.equal(stored.length, 1);
  assert.notEqual(stored[0].token_hash, token);
  await fixture.pool.query("UPDATE password_recovery SET expires_at = now() - interval '1 minute'");
  assert.equal(
    (await request(null, "POST", "/api/recovery/complete", { token, newPassword: password })).json()
      .code,
    "invalid_recovery",
  );
  const second = await request("admin", "POST", path, { currentPassword: password });
  const current = new URLSearchParams(new URL(second.json().url).hash.slice(1)).get("token");
  const changedPassword = randomBytes(20).toString("base64url");
  const results = await Promise.all(
    [0, 1].map(() =>
      request(null, "POST", "/api/recovery/complete", {
        token: current,
        newPassword: changedPassword,
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 400]);
  assert.equal((await request("owner", "GET", "/api/me")).statusCode, 401);
  assert.notEqual(
    (
      await request(null, "POST", "/api/auth/sign-in/email", {
        email: "owner@example.test",
        password,
      })
    ).statusCode,
    200,
  );
  const loginResult = await request(null, "POST", "/api/auth/sign-in/email", {
    email: "owner@example.test",
    password: changedPassword,
  });
  assert.equal(loginResult.statusCode, 200);
  cookies.owner = loginResult.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
});

test("import validates dates/phones/duplicates, preserves dates and is atomic and idempotent; export is restricted and formula-safe", async () => {
  const row = {
    customerName: '=HYPERLINK("https://example.test")',
    phone: "+971501234589",
    source: "call",
    requirement: "Quoted,\nArabic عربي",
    createdAt: "2020-01-02",
  };
  const input = {
    rows: [
      row,
      { ...row, customerName: "Separate enquiry" },
      { ...row, phone: "bad", createdAt: "tomorrow" },
    ],
  };
  assert.equal((await request("owner", "POST", "/api/import/preview", input)).statusCode, 403);
  const preview = (await request("manager", "POST", "/api/import/preview", input)).json();
  assert.equal(preview.rows[1].duplicate, true);
  assert.ok(preview.rows[2].errors.includes("phone"));
  assert.ok(preview.rows[2].errors.includes("createdAt"));
  const selected = [
    { row: 2, acknowledgeDuplicate: false },
    { row: 3, acknowledgeDuplicate: false },
  ];
  const before = (await request("manager", "GET", "/api/dashboard")).json().total;
  assert.equal(
    (await request("manager", "POST", "/api/import/commit", { id: preview.id, selected })).json()
      .code,
    "duplicate_phone",
  );
  assert.equal((await request("manager", "GET", "/api/dashboard")).json().total, before);
  selected[1].acknowledgeDuplicate = true;
  const commit = await request("manager", "POST", "/api/import/commit", {
    id: preview.id,
    selected,
  });
  assert.equal(commit.statusCode, 200, commit.body);
  assert.equal(commit.json().imported, 2);
  assert.deepEqual(
    (await request("manager", "POST", "/api/import/commit", { id: preview.id, selected })).json(),
    commit.json(),
  );
  assert.equal((await request("manager", "GET", "/api/dashboard")).json().total, before + 2);
  const records = (await request("manager", "GET", "/api/leads?q=501234589")).json().items;
  assert.equal(records[0].createdAt, "2020-01-01T20:00:00.000Z");
  assert.equal(records[0].status, "new");
  assert.equal(records[0].assigneeId, null);
  assert.equal((await request("manager", "GET", "/api/export/leads")).statusCode, 403);
  const exported = await request("owner", "GET", "/api/export/leads?q=501234589");
  assert.equal(exported.statusCode, 200);
  assert.ok(exported.body.includes("'=HYPERLINK"));
  assert.ok(exported.body.includes(`'${row.phone}`));
  assert.ok(exported.body.includes("Quoted,\nArabic عربي"));
});
