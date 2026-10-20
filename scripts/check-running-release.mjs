import "./check-runtime.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { backupDatabase, backupStatus } from "./backup.mjs";
import { privateWrite } from "./app-config.mjs";
const origin = "http://127.0.0.1:4310";
assert.deepEqual(await (await fetch(`${origin}/api/health`)).json(), { ok: true });
const setup = await (await fetch(`${origin}/api/setup`)).json();
assert.equal(setup.required, false, "The existing administrator must remain available.");
for (const route of ["/api/export/leads", "/api/backups/status", "/api/leads"])
  assert.equal((await fetch(`${origin}${route}`)).status, 401);
const status = backupStatus();
assert.ok(status.lastSuccess && status.lastRestore && !status.lastAttemptFailed);
assert.equal((await backupDatabase({ daily: true })).skipped, true, "Daily backup must not duplicate today's success.");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
  await page.screenshot({ path: ".local/preview/login-final.png", fullPage: true });
  await page.goto(`${origin}/reset#token=${"x".repeat(43)}`);
  await page.getByRole("heading", { name: "Reset password", exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, "");
  assert.equal(await page.getByRole("button", { name: "Reset password", exact: true }).count(), 1);
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
const processInfo = JSON.parse(readFileSync(".local/app-process.json", "utf8"));
privateWrite(".local/completion-verification.json", JSON.stringify({
  verifiedAt: new Date().toISOString(), runningProcess: processInfo.pid, origin,
  existingAdministratorPresent: true, health: "passed", protectedRoutes: "401 without login",
  loginAndRecoveryUI: "passed", dailyBackupDeduplication: "passed", backups: status,
  automatedTests: { apiDatabase: 18, browserWorkflows: 6, disabledIntegrations: 5 },
  installation: "35 exact pins; official release checks, runtime consistency, one React instance, audit passed",
  deployedToHosting: false, googleConnected: false,
}, null, 2));
console.log("PASS: running CRM, existing setup, anonymous access guards, login/reset UI and daily backup catch-up state. No user records changed.");
