import "./check-runtime.mjs";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// Scan exactly what Git will commit. Never print secret values or file contents.
const git = (...args) => execFileSync("git", args, { encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
const files = git("ls-files", "-z").split("\0").filter(Boolean);
if (!files.length) throw new Error("No staged files to inspect.");
const secrets = [];
if (existsSync(".env.local")) {
  const value = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  if (value) { secrets.push(value); try { secrets.push(decodeURIComponent(new URL(value).password)); } catch { /* Full value is still checked. */ } }
}
if (existsSync(".local/app-secrets.json")) secrets.push(...Object.values(JSON.parse(readFileSync(".local/app-secrets.json", "utf8"))).filter((v) => typeof v === "string"));
for (const path of [".local/setup-link.txt", ".local/recovery-link.txt"]) {
  if (existsSync(path)) {
    const token = readFileSync(path, "utf8").match(/#(?:setup|token)=([A-Za-z0-9_-]+)/)?.[1];
    if (token) secrets.push(token);
  }
}
const blockedPath = /(^|\/)(?:\.local|node_modules|dist|backups|exports|test-results|playwright-report)(\/|$)|(^|\/)\.env(?!\.example$)(?:\.|$)|\.(?:dump|backup|pgpass|pem|key|p12|pfx|log)$/i;
const credentialPattern = /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[A-Za-z0-9_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"private_key"\s*:\s*"-----BEGIN)/;
const problems = [];
let bytes = 0;
for (const path of files) {
  if (blockedPath.test(path)) { problems.push(`${path}: private/generated path`); continue; }
  const content = git("show", `:${path}`);
  bytes += Buffer.byteLength(content);
  if (credentialPattern.test(content)) problems.push(`${path}: credential-shaped content`);
  if (secrets.some((value) => value.length >= 12 && content.includes(value))) problems.push(`${path}: matches a private local secret`);
  if (Buffer.byteLength(content) > 5 * 1024 * 1024) problems.push(`${path}: unexpected large file`);
}
if (problems.length) throw new Error(`Publication scan failed:\n${problems.join("\n")}`);
console.log(`PASS: ${files.length} staged files (${Math.ceil(bytes / 1024)} KiB); no excluded paths, known local secrets or recognized credential patterns. Review staged changes before each push.`);
