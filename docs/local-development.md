# Inaya CRM local development setup

The Windows development prerequisites and project dependencies are installed for the current user. PostgreSQL runs locally and the project has a real package-manager lockfile. The first core CRM screens and business endpoints are now implemented; see [Implementation and startup](implementation.md).

Open `start-crm.cmd` for the application at `http://127.0.0.1:4310`. First-run admin setup uses the private `.local/setup-link.txt`; no default password is installed. `dev.cmd` still opens the tools/database shell. Application checks are `inaya.cmd build`, `inaya.cmd lint`, `inaya.cmd test:crm` and `inaya.cmd test:e2e`.

## Coding readiness

Installation is complete for the agreed initial development scope. Final verification on 20 October 2026 passed from `C:\Windows\system32` through the project launchers: frozen install, 32 exact dependency pins, live latest-version checks, one project Node, singleton React/React DOM, API/database checks, frontend build, TypeScript, migration generation, Chromium launch and full dependency audit. PostgreSQL is running. No mandatory local installation remains before starting CRM code.

Application structure, login/role enforcement and the manual lead-management flow are now implemented. The on-demand shadcn generator, later Google Translation credentials/quota controls and eventual hosting are documented stages. The earlier dependency verification used private fixtures; the new application tests use isolated PostgreSQL schemas and connected browser screens. See [Dependency contract](dependencies.md) for exact versions, Codex usage and inherited deprecation notes.

The disabled integration foundation is now implemented under `src/server/integrations`. Run `inaya.cmd check:integrations` to type-check it and run the five focused Node tests without database/cloud access. Google connections, public ingress routes, live SDK calls, translation budget enforcement and campaign measurement remain deferred. English/Arabic interface development and manual CRM workflows need no Google credentials. See [Integration boundaries](integrations.md).

## Installed versions

| Tool | Installed version | Installation scope |
| --- | --- | --- |
| Node.js | 26.12.0 Current | Official Windows archive in the user's local Programs directory. |
| npm | 11.20.0 | Bundled with the selected Node release; pnpm manages this project. |
| pnpm | 12.14.0 | Exact package manager installed in the user tool directory. |
| PostgreSQL server and psql | 18.6, EDB Windows revision 5 | Official server/client binaries; separate local data directory. |
| Git for Windows | 2.56.0.windows.2 | Official PortableGit release. |
| Project dependencies | 32 exact direct pins | 20 runtime libraries and 12 development dependencies in package.json and pnpm-lock.yaml. |

The Node and Git archive hashes matched their official release metadata. Git's executable signature was valid. PostgreSQL came from the EDB archive linked by the PostgreSQL Windows download page; its downloaded archive hash is recorded in the local installation report.

The tool directories are under `%LOCALAPPDATA%\Programs\InayaCRM` and have been added to the user PATH. An existing machine-wide Node installation and Codex's bundled tools may appear earlier in inherited terminal PATHs. Project activation explicitly selects the installed versions, without replacing those existing installations.

## Open a project development session

Run this in a new PowerShell terminal. The first line permits local scripts only for that terminal session; it does not change the saved machine or user policy:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force
Set-Location -LiteralPath D:\Projects\inaya-crm
. .\scripts\dev-shell.ps1
```

The leading dot activates the project tools in the current session. The command starts the local database if necessary and prints the selected tool versions. No Windows administrator permission is needed for normal use.

Alternatively, open `D:\Projects\inaya-crm\dev.cmd`. It starts a development PowerShell session with a session-only RemoteSigned policy and keeps the terminal open. From an existing terminal, run `& 'D:\Projects\inaya-crm\dev.cmd'`. Use `dev.cmd --check` for a non-interactive startup verification.

For individual package commands from any terminal, use the project wrapper, for example `D:\Projects\inaya-crm\inaya.cmd check:dependencies`. It activates the exact configured tools and runs pnpm from the project root, even when the caller starts in `C:\Windows\system32`. The runtime guard rejects a different Node version or executable path. See [Dependency contract](dependencies.md) for every package's Codex usage and scope.

Both entry points have been checked with Windows PowerShell, including hosts where scripts are disabled by the saved local policy. Process-scoped settings do not override organizational Group Policy. [Microsoft execution policy reference](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies)

To activate tools without starting PostgreSQL:

```powershell
. .\scripts\activate-dev.ps1
```

## Local database

| Setting | Value |
| --- | --- |
| Address | 127.0.0.1 |
| Port | 5432 |
| Database | inaya_crm |
| Application role | inaya_app, not a PostgreSQL superuser |
| Authentication | SCRAM SHA-256 |
| Encoding | UTF-8 |
| Database time zone | Asia/Dubai |

The cluster listens only on the local loopback address. Its data lives under `%USERPROFILE%\.inaya-crm\postgres\data`, outside the source project and dependency folder. The cluster is run by the current Windows user, not registered as an all-users Windows service. After a restart, open a development session to start it again.

The initial LocalAppData location was redirected into Codex's MSIX package cache, so it existed inside Codex while ordinary PowerShell reported it missing. The existing cluster was stopped and copied to the user-profile location with restricted permissions; the original copy was preserved. The paths in `.local/tooling.json` now point to the shared physical location for data, logs and credentials. Keep persistent database state outside app package caches, and verify paths from their actual file handles when diagnosing Windows path redirection.

Use these commands after activation:

```powershell
pnpm db:start
psql --no-password -X -c "SELECT current_database(), current_user;"
pnpm db:stop
```

Use the stop helper before intentionally shutting down the local database. Starting/stopping has been verified without deleting or reinitializing its data.

## Local configuration and credentials

`.local/tooling.json` contains local executable and data paths. `.env.local` contains the application database connection string. Both are excluded from Git. Database administration credentials are encrypted using Windows DPAPI, and the psql password file is inside an access-restricted local directory. The environment file's Windows permissions are restricted as well. Credential values were not printed in setup output.

The setup helper is idempotent for this configured cluster. It reuses saved credentials and existing roles/databases, and refuses to reset an existing cluster that lacks matching saved credentials. Do not copy private credentials or database data into source control.

## Installed dependency checks

Run these after activating the project tools:

```powershell
pnpm check:versions
pnpm check:dependencies
pnpm check:setup
pnpm check:migrations
pnpm check:browser
pnpm audit
```

The setup check verifies exact installed package versions, backend and auth-adapter imports, Fastify validation and plugins, PostgreSQL application login, English/Arabic text round-trip, a React/Vite/Tailwind production smoke build and TypeScript compilation. Temporary verification source/build artifacts stay under the ignored `.local/verification` directory. These checks do not claim that the CRM itself has been implemented or built.

The dependency check rejects inconsistent version files, a wrong project Node, multiple React/React DOM versions or physical module instances, missing Codex usage and competing root lockfiles. The migration check actually generates probe SQL from TypeScript into a fresh ignored directory, without applying it. The browser check launches the matching Playwright Chromium and loads the compiled React/Tailwind fixture. `pnpm check:installation` runs all these checks plus the live version check and full audit; start the existing database first.

Reinstall the recorded tree with `pnpm install --frozen-lockfile`. pnpm 12 reads save/version, strict-engine, peer and build policies from `pnpm-workspace.yaml`; `.npmrc` retains corresponding npm fallback settings. [pnpm configuration reference](https://pnpm.io/settings)

Install scripts are allowed only for the reviewed esbuild versions in the locked tree. The optional protobufjs postinstall version-warning script is explicitly disabled. Exact recent-release exceptions cover the selected current stable versions; future exceptions require review.

## Resolved dependency advisory

The first full-tree audit found [GHSA-67mh-4wv8-2f99](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99) in esbuild 0.18.20, inherited through Drizzle Kit's legacy loader. The narrow override `@esbuild-kit/core-utils@3.3.2>esbuild: 0.28.2` replaces that affected compiler dependency. Migration generation with a TypeScript config/schema, the frontend smoke build and the frozen install all passed after this change. The final full dependency audit reported zero known vulnerabilities.

The parent tools still declare three deprecated transitive helpers: `@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader` and `node-domexception`. They are not extra direct project selections. Do not hide these warnings or substitute unrelated major versions to suppress them. Reevaluate their parent packages during upgrades.

## Items outside this installation

The first CRM business schema and screens are implemented and browser-tested; the user creates the first real administrator through private local setup. No real customer records or shared credentials are seeded. Radix Dialog is used directly; the shadcn source generator remains optional and was not invoked. Playwright uses matching Chromium under `%USERPROFILE%\.inaya-crm\browsers`. Google connections and live integrations remain deferred.

Google Cloud Translation and Google Ads require business account configuration and credentials before live use. The user has created a Google Cloud project and free-trial billing account; the reported card payment is not proof of an enabled or connected Translation API. This local installation does not provision paid cloud resources or make billable API calls. Hosting is still undecided. Node 26 is currently the selected development runtime; the production LTS rule in the technology document still applies.
# Local completion operations

The local CRM now includes editing/history, recovery, roles, archive/restore, file import/export and restore-tested local backups. See [Operations guide](operations.md) and [Completion report](completion-report.md). Current dependency count is 35; earlier baseline figures below are installation history.

Use `inaya.cmd db:backup` for a fresh private backup and `inaya.cmd db:restore-test` to verify it in a disposable database. The running server checks for a daily backup at startup and hourly. `inaya.cmd recover:account actual-admin@example.com` creates a private short-lived recovery link for an existing active administrator; it never prints the token.
