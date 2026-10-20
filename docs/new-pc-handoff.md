# Continue on a new Windows PC

Confirmed on 20 October 2026: use a new Windows PC and preserve existing administrator accounts and CRM data.

## Two separate transfers

1. Clone `https://github.com/emranyounasdxb-ai/inaya-crm.git` to a local project folder, such as `D:\Projects\inaya-crm` (or `C:\Projects\inaya-crm` if there is no D drive).
2. Copy the private transfer folder from the old PC using a trusted private channel, preferably an encrypted USB drive. Keep it outside the cloned repository. It contains a `.dump`, matching `.manifest.json` and `README-PRIVATE.txt`. Never upload it to this public GitHub repository.

The handoff backup was restored into a disposable database on the original PC and all 11 table counts/content hashes matched. It is a point-in-time copy: changes made on the old PC after the backup are not synchronized. Stop entering new business data there before final cutover, or prepare another fresh backup and repeat verification.

## What GitHub does not contain

The source repository deliberately excludes `.env.local`, `.local/tooling.json`, database files, credentials, backups, installed tools, `node_modules` and generated browser files. Downloading/cloning the code does not install or configure a new machine. `start-crm.cmd` requires the new machine's tool configuration first.

Do not copy Windows DPAPI credentials from the old account. Do not reuse old executable/data paths or copy a running PostgreSQL data directory. Create fresh PostgreSQL connection credentials and fresh authentication/bootstrap secrets on the new PC. Existing account password hashes are in the database dump, so existing users keep their passwords; browser sessions will be cleared and users sign in again.

## Instructions for the agent on the new PC

Read `AGENTS.md`, requirements, technology stack, dependencies, local development, implementation and operations documents before changing the project. Google connections and hosting remain explicitly deferred.

1. Inspect the new PC first. Preserve any existing PostgreSQL clusters and other software. Determine available drives, tool paths and a free loopback port. Do not run the old machine's launchers until `.local/tooling.json` is regenerated.
2. Install/configure the exact project toolchain recorded in `toolchain.lock.json`, `.node-version`, `package.json` and `pnpm-workspace.yaml`. The handoff baseline is Node 26.12.0, pnpm 12.14.0, PostgreSQL 18.6 and Git for Windows 2.56.0.windows.2. Verify official release artifacts and hashes; if a pin is unavailable or no longer matches the documented version policy, explain and reconcile the documents/compatibility before choosing another version. Do not silently substitute the machine's Node or upgrade React.
3. Create ignored `.local/tooling.json` with this PC's absolute `nodeDirectory`, `pnpmDirectory`, `gitDirectory`, `postgresBin`, `postgresData`, `postgresLog`, `postgresPort` and `pgpassFile`. Persistent database state should be under `%USERPROFILE%\.inaya-crm\postgres`, outside MSIX/app caches. Create/restrict its private credential directory and use process-scoped execution policy only.
4. Run `scripts/setup-local-database.ps1` for the newly configured empty cluster/database. It creates fresh private DPAPI credentials, the restricted `inaya_app` role, database and `.env.local`. Never initialize over an existing cluster without matching credentials, and never overwrite another CRM database.
5. Activate the configured tools, install with `pnpm install --frozen-lockfile`, and install the Chromium version matching the locked Playwright package. Keep the project runtime guard and dependency checks enabled.
6. Verify the transferred dump's SHA-256 against its manifest. Before restoring, verify that the destination `inaya_crm` database is newly created and contains no business tables/data. If it already contains data, preserve it and use a separately prepared destination; do not clear it to make restoration succeed.
7. Restore the dump using the new machine's PostgreSQL tools and `inaya_app` credentials with owner/ACL restoration disabled. The dump includes `public` and `drizzle`; a new database already has an empty `public` schema. Resolve that empty-schema conflict only in the verified empty destination (for example, `pg_restore --clean --if-exists --exit-on-error --no-owner --no-privileges`). Do not use these flags against a populated CRM. Keep passwords out of command arguments and logs.
8. Compare all restored table counts/content hashes with the transfer manifest using the snapshot fingerprint logic in `scripts/backup.mjs`. Record verification privately. Then invalidate restored `session`, `password_recovery` and `verification` entries in the **new copy only**. Preserve `user`, `account`, leads, comments, history and role assignments. Create a fresh `.local/app-secrets.json` through the normal app configuration; do not import the old auth/bootstrap secret.
9. Apply reviewed migrations, build and test using isolated schemas. Run `check:dependencies`, `check:installation`, `build`, `lint`, `test:crm` and `test:e2e`. Create a new-PC backup and run `db:restore-test`.
10. Start on the configured loopback origin, normally `http://127.0.0.1:4310`. Confirm `/api/setup` reports `required: false`. Let the user enter the existing administrator email/password; do not invent or reset their password. Verify login and restored records. Keep the old PC intact until the user has confirmed the new copy.

Local helper scripts assume Windows and the regenerated tool configuration; no complete one-click prerequisite installer is currently committed. The new agent must perform the above setup before claiming the cloned project runs.

## Prompt to paste into Codex on the new PC

> Continue Inaya CRM from https://github.com/emranyounasdxb-ai/inaya-crm on this Windows PC. Clone it into a suitable local Projects folder if needed and read AGENTS.md plus docs/new-pc-handoff.md. I have a private verified database transfer folder; locate it in the location I provide. Install/configure the required project tools yourself, regenerate machine-local settings, restore my existing admin and data into a verified empty local database, and run the build, tests and backup restore check. Preserve any existing databases/software. Do not upload credentials or the transfer files to GitHub. Google integrations and hosting remain deferred. Keep the old PC copy intact and give me the local URL and verification report when ready.

The user must provide the transfer folder's actual new-PC location. Never guess that the old `C:\Users\Faizzy` paths exist on the new machine.
