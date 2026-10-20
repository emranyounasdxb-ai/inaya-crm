import "./check-runtime.mjs";
import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { buildApp } from "../src/server/app.ts";
import { createAccount } from "../src/server/services/accounts.ts";
import { assignLead, createLead, updateLead } from "../src/server/services/leads.ts";
import { testDatabase } from "../tests/database.mjs";
import { privateWrite } from "./app-config.mjs";

const fixture = await testDatabase();
const password = randomBytes(24).toString("base64url");
const people = {};
for (const [key, name, role] of [
  ["admin", "Admin Preview", "admin"], ["manager", "Sara Ahmed", "manager"],
  ["staff", "Maryam Hassan", "staff"], ["other", "Omar Ali", "staff"], ["owner", "Owner Preview", "owner"],
]) {
  people[key] = await createAccount(fixture.db, { name, email: `${key}@example.test`, role, password });
}
for (const [index, name] of ["Aisha Khalid", "فاطمة أحمد", "Nadia Saleem", "Layla Hassan", "Huda Mohammed", "Mariam Saeed"].entries()) {
  const lead = await createLead(fixture.db, people.manager, { customerName: name, phone: `+97150123456${index}`, source: ["whatsapp", "referral", "call", "google_ads", "website", "instagram"][index], requirement: "Preview enquiry — looking for a domestic worker. أحتاج إلى مساعدة منزلية.", acknowledgeDuplicate: false });
  if (index !== 5) await assignLead(fixture.db, people.manager, lead.id, { version: 1, assigneeId: index % 2 ? people.other.id : people.staff.id, nextFollowUpAt: new Date(Date.now() + (index + 1) * 3600000).toISOString() });
  if (index === 0) await updateLead(fixture.db, people.staff, lead.id, { version: 2, status: "converted", nextFollowUpAt: null, lostReason: null, lostExplanation: "", reopenReason: "" });
  if (index === 1) await updateLead(fixture.db, people.other, lead.id, { version: 2, status: "interested", nextFollowUpAt: new Date(Date.now() + 3600000).toISOString(), lostReason: null, lostExplanation: "", reopenReason: "" });
}
mkdirSync(".local/preview", { recursive: true });
privateWrite(".local/e2e-fixture.json", JSON.stringify({ password, people, schema: fixture.schema }));
const app = await buildApp({ db: fixture.db, origin: "http://127.0.0.1:4311", secret: randomBytes(48).toString("base64url"), bootstrapKey: "", serveWeb: true });
await app.listen({ host: "127.0.0.1", port: 4311 });
let stopped = false;
async function stop() {
  if (stopped) return;
  stopped = true;
  await app.close();
  await fixture.cleanup();
  rmSync(".local/e2e-fixture.json", { force: true });
}
// Playwright's global teardown also removes the isolated test schema because
// Windows process-tree termination may not deliver SIGTERM.
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
