import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { userInfo } from "node:os";

export function privateWrite(path, content) {
  writeFileSync(path, content, { mode: 0o600 });
  if (process.platform === "win32") {
    execFileSync("icacls.exe", [path, "/inheritance:r", "/grant:r", `${userInfo().username}:(F)`, "SYSTEM:(F)"], { stdio: "pipe", windowsHide: true });
  }
}
export function localConfig() {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.AUTH_SECRET || !process.env.APP_ORIGIN?.startsWith("https:")) throw new Error("Production needs explicit AUTH_SECRET and HTTPS APP_ORIGIN.");
    return { secret: process.env.AUTH_SECRET, bootstrapKey: process.env.BOOTSTRAP_KEY ?? "", origin: process.env.APP_ORIGIN };
  }
  mkdirSync(".local", { recursive: true });
  const path = resolve(".local/app-secrets.json");
  if (!existsSync(path)) privateWrite(path, JSON.stringify({ secret: randomBytes(48).toString("base64url"), bootstrapKey: randomBytes(32).toString("base64url") }));
  const data = JSON.parse(readFileSync(path, "utf8"));
  const origin = process.env.APP_ORIGIN ?? "http://127.0.0.1:4310";
  const parsed = new URL(origin);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) throw new Error("Local development origin must be loopback.");
  privateWrite(resolve(".local/setup-link.txt"), `${origin}/#setup=${data.bootstrapKey}\n`);
  return { ...data, origin };
}
