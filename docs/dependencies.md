# Dependency installation and Codex usage contract

Reviewed and completed: 20 October 2026 at 16:16 (Asia/Dubai). The package usage plan was written before the dependency refresh; the completion record below reports the finished checks.

The CRM uses one React frontend, one Fastify API and one PostgreSQL database. All 32 application/build dependencies are part of the authorized initial installation. The first core application has subsequently been implemented without changing these pins. [Implementation status](implementation.md) maps actual feature paths and application verification separately from the historical installation checks below. Radix is used directly for accessible dialogs and direction; the shadcn generator was not needed. Optional styling helpers and the deferred Google SDK are not initialized merely because they are installed.

## Exact tools and one project runtime

| Tool | Exact selected version | What Codex will use it for | Installation / selection |
| --- | --- | --- | --- |
| Node.js | 26.12.0 Current | Run the API, package scripts, build tools and Node's built-in server test runner | One project executable selected by `.local/tooling.json`; all project entry points must use it. |
| pnpm | 12.14.0 | Install, resolve and audit dependencies; run project commands | One selected package manager, declared in `package.json`. |
| npm | 11.20.0, bundled with Node | Bootstrap the selected pnpm installation only | Do not use npm install in this project or create package-lock.json. |
| PostgreSQL | 18.6, EDB Windows revision 5 | Store CRM records, accounts, history and translations | Existing local database, loopback only; no cluster reset or second CRM cluster. |
| Git for Windows | 2.56.0.windows.2 | Track source and review changes when the directory becomes a Git repository | Portable official installation selected by activation. This directory currently has no Git repository. |

Node is pinned in `package.json` (`engines` and `devEngines.runtime`), `.node-version` and `toolchain.lock.json`. pnpm's `nodeVersion` checks dependency compatibility, while `runtimeOnFail: error`, `pmOnFail: error`, a preinstall guard and the project launcher prevent silent runtime/package-manager substitutions. These settings must agree. Node 26 is Current at this review, not LTS; production requires the documented LTS gate.

The machine also has Node 24.20.0 in `C:\Program Files\nodejs`, and Codex has its own Node 24.19.0. Those belong to the machine and the Codex runtime, outside this project's installation. They are not the CRM's backend/build runtime. Do not remove app-owned executables or describe the entire computer as having only one Node. The project guard checks the actual Node version and local executable path, including child-script execution.

## Browser and UI dependencies

These are runtime dependencies. Browser code must not import server credentials or database/translation clients.

| Package | Exact version | Purpose | What Codex will build with it / planned location |
| --- | --- | --- | --- |
| react | 19.3.1 | Interactive UI and component state | Lead forms, lists, details, reports and settings in `src/web/features`. |
| react-dom | 19.3.1 | Browser rendering | Mount that same React application in `src/web/main.tsx`; no second React root framework. |
| radix-ui | 1.8.1 | Accessible control behavior and direction context | Needed dialogs, dropdowns and RTL direction provider in `src/web/components/ui`. |
| clsx | 2.1.1 | Conditional CSS classes | Compose disabled, selected, error and loading states in `src/web/lib/classes.ts`. |
| tailwind-merge | 3.7.0 | Resolve conflicting Tailwind utility classes | Merge component defaults and overrides in the same class helper. |
| lucide-react | 1.60.0 | UI icons | Navigation, search, assignment, language and follow-up controls in `src/web/components`. |
| react-router | 8.5.0 | Client navigation | Login, leads, lead details, reports and settings in `src/web/app/router.tsx`. |
| @tanstack/react-query | 5.104.5 | API response caching and write refresh | Lead/report queries and mutations in `src/web/features`; clear user-scoped data on logout. |
| i18next | 26.5.3 | Fixed interface translations | English/Arabic resources and user language changes in `src/web/i18n`. |
| react-i18next | 17.1.0 | Bind interface language to React | Re-render translated controls when the user's language changes. |

React and React DOM must both resolve to exactly 19.3.1 throughout the reachable dependency graph. React types have their own versions, listed below; they are type definitions, not another runtime React. The consistency check rejects multiple runtime versions or distinct physical React module instances. Peer conflicts remain errors; do not hide them with force flags, loose peer rules or an incompatible override.

## API, database and shared contracts

These are the other ten runtime dependencies. Shared validation can be used in the UI; database and provider clients remain on the server.

| Package | Exact version | Purpose | What Codex will build with it / planned location |
| --- | --- | --- | --- |
| better-auth | 1.7.12 | Staff accounts and sessions | Email/password login and admin account management in `src/server/auth.ts`; public signup disabled. Lead/role authorization remains application code. |
| fastify | 5.12.7 | HTTP API | Lead capture, assignment, comments, status, follow-ups, reports and translation routes in `src/server/app.ts` and `src/server/routes`. |
| @fastify/static | 10.1.6 | Serve frontend assets | Serve the Vite production build from the same origin as the API. |
| @fastify/helmet | 13.2.0 | HTTP security headers | Configure headers in `src/server/app.ts`, compatible with the actual frontend. |
| @fastify/rate-limit | 11.2.1 | Repeated-request limits | Protect login and public enquiry routes; production shared limits depend on deployment. |
| drizzle-orm | 0.45.4 | Typed SQL and transactions | Role-scoped reads and atomic lead/history changes in `src/server/db` and services. |
| pg | 8.23.1 | PostgreSQL driver and pool | Open database connections for Drizzle in `src/server/db/client.ts`. This is not another database server. |
| @google-cloud/translate | 10.3.0 | Future Google Cloud Translation v3 adapter | Retain the installed SDK for a later adapter under `src/server/integrations/google`; keep it uninitialized now. The core uses the translation port and original-text fallback in `src/server/integrations`. |
| zod | 4.6.7 | Shared input validation | Lead/comment/status contracts in `src/shared/contracts`; export draft-7 JSON Schema for Fastify's default validator. |
| libphonenumber-js | 1.13.15 | Phone parsing and normalization | Normalize international numbers with default +971 in `src/server/services/phone.ts`; flag possible duplicate enquiries without silently merging them. |

## Development dependencies

These twelve packages support development and testing; do not ship their CLIs to staff browsers.

| Package | Exact version | Purpose | How Codex will use it |
| --- | --- | --- | --- |
| typescript | 7.0.2 | Type checking and server compilation | Check frontend, server and shared contracts through the project compiler; use `vite/client` types for Vite assets. |
| vite | 8.3.4 | Frontend development/build | Configure frontend assets and API development proxy in `vite.config.ts`. |
| @vitejs/plugin-react | 6.1.2 | Vite React integration | JSX transformation and development refresh through Vite. |
| tailwindcss | 4.3.3 | UI styling | Desktop layout, spacing, states and RTL-aware logical properties in `src/web/styles`. |
| @tailwindcss/vite | 4.3.3 | Tailwind build integration | Compile Tailwind through Vite; no separate direct PostCSS setup. |
| drizzle-kit | 0.31.11 | Migration generation/application | Generate reviewable SQL from `drizzle.config.ts` and schema; apply only intentionally reviewed migrations. |
| @types/pg | 8.23.1 | PostgreSQL driver types | Check typed database connection/pool use. |
| @types/node | 26.6.5 | Node API types | Check server/runtime APIs against the selected Node major. This is not a Node executable. |
| @types/react | 19.3.0 | React component types | Check components and hooks; this is not another React runtime version. |
| @types/react-dom | 19.3.0 | React browser types | Check browser mounting and DOM integrations. |
| @biomejs/biome | 2.5.15 | Formatting and linting | One code style/lint tool; TypeScript still checks types. No parallel ESLint/Prettier setup. |
| @playwright/test | 1.64.1 | Browser workflow verification | Desktop Chromium checks for login, roles, lead capture, assignment and English/Arabic layouts in `tests/e2e`. |

The Playwright CLI installs its matching Chromium build into `%USERPROFILE%\.inaya-crm\browsers`, outside the Codex package cache. Use this revision with the selected Playwright release; do not independently replace it with an arbitrary browser revision. Only Chromium is needed for the initial test target; Firefox/WebKit are not additional installation requirements. Its download and a browser launch smoke check are included in this refresh. Real CRM end-to-end tests come after those screens exist.

## Source generator and excluded installations

`shadcn@4.22.1` is an on-demand source generator, not a missing runtime dependency. Codex may invoke that exact version to create a needed control in `src/web/components/ui`, then review the generated source and proposed manifest changes. Do not allow the generator to replace project pins or add a second React. The remote component registry is not frozen by the CLI version. It is not installed globally or added to the 32-package application baseline.

The excluded list and reasons remain in [Technology stack](technology-stack.md): no Next.js, extra form framework, chart/table library, spreadsheet parsers without a sample, duplicate formatter/test runner, Redis, message broker, Google Ads SDK or mandatory cloud deployment CLI. Hosting remains undecided. Google's project/free trial exists, but production credentials, translation quotas and cost limits are not configured. Package installation does not activate billing, make translation calls or deploy resources.

Latest confirmed scope: all Google connections are deferred; implement only the disabled provider-neutral foundation described in [Integrations](integrations.md). Retain the Google SDK without initializing it. On later activation, use standard NMT only within the eligible 500,000-character monthly free allowance, with a 400,000-character warning, atomic server-side usage reservations and a pause before new calls exceed the remaining allowance. Existing cached translations and original text remain available. Google billing does not stop automatically at this threshold; verify shared allowance usage and provider settings before activation. No paid continuation or provider replacement is authorized. See [Requirements](requirements.md) for the full policy. No LibreTranslate/Azure dependencies are added by discussing those alternatives.

## Version selection and clean installation rules

1. Read this contract and the requirements before changing dependencies. Verify current stable, non-deprecated npm `latest` tags and official Node/PostgreSQL/Git releases; record the check time and integrity evidence. A new stable Better Auth patch, 1.7.12, replaces 1.7.11 in this refresh.
2. Save exact direct versions, never `latest`, `^`, `~`, prereleases or compatibility bypasses. Keep `package.json`, `toolchain.lock.json`, `.node-version`, pnpm policy and docs synchronized. Preserve one root `pnpm-lock.yaml`; no nested application manifests or extra npm/yarn lockfiles.
3. Use `inaya.cmd` to run pnpm from any terminal. It selects the configured Node/pnpm and changes to the project directory. Codex can also dot-source `scripts/activate-dev.ps1` before project commands. Run the local runtime guard before install; do not silently download another project Node.
4. Resolve the reviewed update, then verify `install --frozen-lockfile`. Install scripts are permitted only for the exact reviewed esbuild versions. Do not clear the database, credentials or package store to hide a failed install.
5. Run the offline installed-tree consistency check, live release check, full dependency audit, API/database/build/type checks, actual migration generation and Chromium launch check. Log failures; do not mark installation complete if a required check fails.

All direct selections must be current at the recorded check. Parent libraries also install internal dependencies with their own compatible ranges. Some internal packages can legitimately require different versions; forcing every internal helper to its newest major can break the parent. `pnpm-lock.yaml` records those exact resolutions. The one-version rule is enforced for React/React DOM and project Node, not misrepresented as a guarantee that all transitive packages are latest.

Three known deprecated internal helpers are inherited by the selected stable tools: `@esbuild-kit/core-utils@3.3.2` and `@esbuild-kit/esm-loader@2.6.5` through Drizzle Kit, and `node-domexception@1.0.0` through Google's SDK dependency chain. These are disclosed upstream limitations, not additional direct choices. Do not suppress their warnings or claim there are none. The narrow esbuild override documented in [Local development setup](local-development.md) resolves its known advisory and must retain migration-generation validation.

References: [pnpm runtime settings](https://pnpm.io/settings/cli), [pnpm runtime manifest](https://pnpm.io/package_json#devenginesruntime), [Playwright browser installation](https://playwright.dev/docs/browsers), and package registry sources in [toolchain.lock.json](../toolchain.lock.json).

## Completion record

Status: **completed and verified** at 20 October 2026 at 16:16 (Asia/Dubai). Codex ran the commands directly, including the normal Windows PowerShell launcher from C:\Windows\system32.

| Check | Observed result |
| --- | --- |
| Official release check | All 34 selected npm entries match live stable latest tags; Node 26.12.0, PostgreSQL 18.6 and Git 2.56.0.windows.2 match their official feeds at the check time. |
| Installed application/build dependencies | 32 exact pins; Better Auth updated to 1.7.12. |
| Frozen installation | Passed with pnpm 12.14.0; preinstall verified the actual Node executable. |
| Node agreement | 26.12.0 in manifest, dev runtime declaration, pnpm settings, .node-version and baseline; wrong machine/Codex Node rejected. |
| React / React DOM | Both 19.3.1; one reachable version and one physical module instance each. |
| React type definitions | Both 19.3.0; one physical module instance each; not extra React runtimes. |
| Dependency advisory audit | Zero known vulnerabilities in the full installed tree. Three deprecated inherited helpers remain disclosed above. |
| API/database checks | Fastify validation/plugins, restricted PostgreSQL login and English/Arabic round-trip passed. |
| Build/types | React + Vite + Tailwind fixture build and TypeScript compilation passed. |
| Migration tooling | Actual SQL generation from a TypeScript config/schema passed. No migration applied to the database. |
| Browser tooling | Playwright 1.64.1 with matching Chromium 156.0.8078.4; compiled React mounts and Tailwind styles load without page errors. |
| External services | No translation calls or deployments performed; credentials and provider cost limits remain to be configured. |

Reviewed exact recent-release exceptions admit Better Auth 1.7.12, its seven matching internal packages and better-call 1.4.4. Existing exact Query/i18next/icon/router exceptions remain. The release-age policy itself remains enabled; no blanket age bypass was used.

Run `inaya.cmd check:installation` for the complete check sequence, or `inaya.cmd check:dependencies` for the offline consistency check. Start PostgreSQL with `dev.cmd` when required. Ignored local evidence: `.local/dependency-refresh-report.json`, `.local/dependency-consistency.json`, `.local/setup-check.json`, `.local/migration-setup-check.json`, `.local/browser-setup-check.json` and `.local/dependency-audit.json`. None of these reports contains passwords. These checks establish dependency readiness; they do not establish implemented CRM screens or workflows.
# File import/export completion — 20 October 2026

The requested spreadsheet feature now justifies three additional exact project dependencies. Existing runtime and React versions stay unchanged. The earlier 32-package inventory describes the first release; the completed inventory is 35 direct packages.

| Package | Exact version | Purpose and Codex use |
| --- | --- | --- |
| read-excel-file | 9.3.12 | Read supplied XLSX files in `src/web/features/import-worker.ts`, first worksheet only, before mapping and manager review. No Google connection. |
| papaparse | 5.7.0 | Read CSV safely, including quoted multiline cells, in the same worker. Generate owner/admin CSV exports in `src/server/services/import-export.ts`, escaping spreadsheet formula cells. |
| @types/papaparse | 5.5.2 | Compile-time declarations for those CSV calls; development only. |

Official npm latest tags and non-deprecated status are verified before installation; `toolchain.lock.json` records metadata and integrity. `pnpm-lock.yaml` locks the installed transitive graph. XLSX/CSV imports are bounded and previewed; export is UTF-8 CSV supported by Excel. Legacy binary `.xls` files must be saved as `.xlsx` or `.csv` first.
