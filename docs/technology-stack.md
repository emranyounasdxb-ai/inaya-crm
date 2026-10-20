# Inaya CRM technology stack

Status: audited implementation baseline for React + Vite, Fastify and PostgreSQL.

Current integration scope: defer all Google connections. [Integration foundation](integrations.md) records the provider-neutral contracts, server-only disabled defaults and future adapter boundaries. No Google keys, account configuration or live request is needed for the core CRM. The Translation SDK remains installed for the later adapter; interface localization uses local resources now.

Initial baseline verified on 20 October 2026 at 14:15 Dubai time; dependency refresh completed at 20 October 2026 at 16:16 (Asia/Dubai). [toolchain.lock.json](../toolchain.lock.json) records exact versions, official registry evidence, planned code locations and installation results. The first local application is now implemented with the same 32 exact dependencies; see [Implementation status](implementation.md) for actual code locations and checks.

The [dependency usage contract](dependencies.md) is the current package-by-package Codex usage and installation scope reference. The refresh installed Better Auth 1.7.12, enforced one project Node and React instance, and installed Playwright's matching Chromium. Its completion record lists the actual checks and disclosed upstream limitations.

## Architecture and scope

Use a React + Vite single-page interface and a Node.js Fastify REST/JSON API. Fastify can serve the built frontend on the same origin as the API, allowing one application deployment. This is one CRM for one company, with one shared PostgreSQL database. A Vite development proxy can forward API requests during development.

The frontend owns navigation, forms and interaction feedback. The API validates requests, checks the staff session and lead permissions, performs database changes, and calls the translation service. Database credentials and translation credentials stay on the server.

Next.js is no longer selected. The UI performance plan is cached API data, server-side filtering/pagination, route splitting, small payloads and clear save feedback. Choosing Vite or Fastify does not by itself establish an end-to-end response time.

The original feature layout below is an architecture guide. The implemented entry point is `src/web/main.tsx`; screens live in `src/web/features`, reusable controls in `src/web/components/ui.tsx`, API routes in `src/server/app.ts` and domain rules in `src/server/services`. See the implementation document for the current file map.

- src/web/features: leads, follow-ups, reporting and staff screens.
- src/web/components/ui: selected reusable controls.
- src/web/app/router.tsx: client-side routes.
- src/web/i18n: English and Arabic interface messages.
- src/server/app.ts and routes: Fastify application and REST endpoints.
- src/server/auth.ts: staff accounts and sessions.
- src/server/db and services: data access, business rules and translation caching.
- src/shared/contracts: shared input validation.
- migrations and tests/e2e: schema changes and browser workflow checks.

## Feature to tool mapping

| CRM need | Selected tool | Concrete use |
| --- | --- | --- |
| Interactive screens | React + React DOM | Render the lead list, lead detail, manager assignment and reporting screens. |
| Frontend build | Vite + React plugin | Run frontend development and produce deployable browser assets. |
| Navigate screens | React Router | Login, lead list/detail, reports and settings navigation. |
| Keep data current | TanStack Query | Cache lead/report responses and invalidate or update them after writes. Clear user-scoped cached data on logout or account change. |
| API endpoints | Fastify | Lead capture, assignment, status, comments, follow-ups, reports and translation endpoints. |
| Staff accounts | Better Auth | Email/password sessions, admin account creation and deactivation; role checks remain application code. |
| Business records | PostgreSQL + Drizzle + pg | Store leads, accounts, comments, assignments, history and translations, and query them within the user's access. |
| Database changes | Drizzle Kit | Reviewable migrations as fields and constraints are added. |
| Desktop visual design | Tailwind + selected shadcn/Radix controls | Forms, menus, dialogs, tables and RTL-aware layout. Only generate controls that a screen actually needs. |
| Interface language | i18next + react-i18next | Maintained English/Arabic labels, messages, per-user language switching and React updates. |
| Business text translation | Google Cloud Translation Advanced v3 | Translate customer requirements/comments and cache translated copies while preserving originals. |
| Validate entry | Zod + libphonenumber-js | Validate form/API inputs and normalize phone values. The API remains authoritative. |
| Public endpoint handling | Helmet + rate-limit plugins | HTTP security headers and limits on repeated form/login requests. |
| Deployable browser assets | Fastify static plugin | Serve the built Vite files and client routes on the same origin as the API. |

## Selected runtime libraries

These 20 packages execute in either the browser or the server. Server libraries such as pg, Better Auth's server handlers and the Google SDK must not be bundled into browser code.

| Package | Exact version | Purpose |
| --- | --- | --- |
| [react](https://registry.npmjs.org/react/19.3.1) | 19.3.1 | Staff screens, customer form and interactive controls |
| [react-dom](https://registry.npmjs.org/react-dom/19.3.1) | 19.3.1 | Mount React screens into the browser |
| [radix-ui](https://registry.npmjs.org/radix-ui/1.8.1) | 1.8.1 | Keyboard accessible dialogs, menus and RTL direction context |
| [clsx](https://registry.npmjs.org/clsx/2.1.1) | 2.1.1 | Conditional component state classes |
| [tailwind-merge](https://registry.npmjs.org/tailwind-merge/3.7.0) | 3.7.0 | Resolve conflicting classes on generated components |
| [lucide-react](https://registry.npmjs.org/lucide-react/1.60.0) | 1.60.0 | Navigation, search, assignment and follow-up icons |
| [react-router](https://registry.npmjs.org/react-router/8.5.0) | 8.5.0 | Navigate login, leads, lead detail, reports and settings |
| [@tanstack/react-query](https://registry.npmjs.org/%40tanstack%2Freact-query/5.104.5) | 5.104.5 | Cache API results and refresh lists after saves |
| [i18next](https://registry.npmjs.org/i18next/26.5.3) | 26.5.3 | Maintain English and Arabic interface messages and locale |
| [react-i18next](https://registry.npmjs.org/react-i18next/17.1.0) | 17.1.0 | Bind translated interface messages to React components |
| [better-auth](https://registry.npmjs.org/better-auth/1.7.12) | 1.7.12 | Staff email/password sessions and account administration |
| [fastify](https://registry.npmjs.org/fastify/5.12.7) | 5.12.7 | Handle REST JSON endpoints for leads, reports and translation |
| [@fastify/static](https://registry.npmjs.org/%40fastify%2Fstatic/10.1.6) | 10.1.6 | Serve built frontend and its assets from the same origin as the API |
| [@fastify/helmet](https://registry.npmjs.org/%40fastify%2Fhelmet/13.2.0) | 13.2.0 | Set application HTTP security headers |
| [@fastify/rate-limit](https://registry.npmjs.org/%40fastify%2Frate-limit/11.2.1) | 11.2.1 | Throttle repeated public enquiry and authentication requests |
| [drizzle-orm](https://registry.npmjs.org/drizzle-orm/0.45.4) | 0.45.4 | Typed queries, role-scoped data and atomic lead/history writes |
| [pg](https://registry.npmjs.org/pg/8.23.1) | 8.23.1 | Provide the PostgreSQL connection pool used by Drizzle |
| [@google-cloud/translate](https://registry.npmjs.org/%40google-cloud%2Ftranslate/10.3.0) | 10.3.0 | Translate narrative text on the server and store cached copies |
| [zod](https://registry.npmjs.org/zod/4.6.7) | 4.6.7 | Validate lead forms and API contracts; export JSON schemas as needed |
| [libphonenumber-js](https://registry.npmjs.org/libphonenumber-js/1.13.15) | 1.13.15 | Normalize country codes and compare customer phone numbers |

Use React's normal form state and the shared Zod contracts for the four-field lead form. Zod supports [JSON Schema export](https://zod.dev/json-schema); select the draft-7 target when supplying schemas to Fastify's default validator. This combination passed an actual validation check after installation. Avoid an extra form framework or schema bridge until the form complexity justifies it.

Use [i18next language switching](https://react.i18next.com/latest/usetranslation-hook) for fixed interface text, not machine translation of those labels on every screen load. Set HTML language/direction and Radix direction context separately. Use the Google service for narrative business text only. Preserve source revisions and reuse translations as described in the requirements.

## Development and build helpers

These 14 entries are build tools, type definitions, a source generator or a package manager. They are not 14 additional customer features and must not all become production runtime dependencies.

| Package | Exact version | Kind | Purpose |
| --- | --- | --- | --- |
| [typescript](https://registry.npmjs.org/typescript/7.0.2) | 7.0.2 | development | Check frontend, API and shared contract types |
| [vite](https://registry.npmjs.org/vite/8.3.4) | 8.3.4 | development | Develop and bundle the React frontend |
| [@vitejs/plugin-react](https://registry.npmjs.org/%40vitejs%2Fplugin-react/6.1.2) | 6.1.2 | development | Integrate React JSX and refresh with Vite |
| [tailwindcss](https://registry.npmjs.org/tailwindcss/4.3.3) | 4.3.3 | development | Consistent desktop UI styling and logical layout properties |
| [@tailwindcss/vite](https://registry.npmjs.org/%40tailwindcss%2Fvite/4.3.3) | 4.3.3 | development | Compile Tailwind through the Vite pipeline |
| [shadcn](https://registry.npmjs.org/shadcn/4.22.1) | 4.22.1 | generator | Generate only selected dialogs, menus, buttons and form controls |
| [drizzle-kit](https://registry.npmjs.org/drizzle-kit/0.31.11) | 0.31.11 | development | Generate and apply reviewed schema migrations |
| [@types/pg](https://registry.npmjs.org/%40types%2Fpg/8.23.1) | 8.23.1 | development | Type checking for the pg driver |
| [pnpm](https://registry.npmjs.org/pnpm/12.14.0) | 12.14.0 | package-manager | Install exact dependencies and maintain the package-manager lockfile |
| [@types/node](https://registry.npmjs.org/%40types%2Fnode/26.6.5) | 26.6.5 | development | Type checking for Node server APIs |
| [@types/react](https://registry.npmjs.org/%40types%2Freact/19.3.0) | 19.3.0 | development | Type checking for React components |
| [@types/react-dom](https://registry.npmjs.org/%40types%2Freact-dom/19.3.0) | 19.3.0 | development | Type checking for browser mounting |
| [@biomejs/biome](https://registry.npmjs.org/%40biomejs%2Fbiome/2.5.15) | 2.5.15 | development | One formatter and linter for TypeScript React and server code |
| [@playwright/test](https://registry.npmjs.org/%40playwright%2Ftest/1.64.1) | 1.64.1 | development | Verify role access, capture, status changes and English/Arabic browser flows |

The shadcn CLI generates source files into the project; it is not a second application UI framework. [Its documentation describes this source distribution model](https://ui.shadcn.com/docs). Generate selected controls and commit the result. Pinning the generator version does not freeze a remotely changing component registry. The clsx and tailwind-merge helpers support those components; they are not alternative styling frameworks.

Biome provides [formatting and linting in one package](https://biomejs.dev/guides/getting-started/). TypeScript still performs full type checking. Initially use the [built-in Node test runner](https://nodejs.org/api/test.html) for server/domain rules, running compiled JavaScript tests, and Fastify's request injection for API checks. Add Playwright once connected user workflows are available, to test access, capture, reassignment, follow-ups and both language layouts. Browser tooling is not shipped to staff browsers.

## Removed or deferred tools from the first list

The first baseline mixed core requirements, optional features and hosting candidates. The following 19 package entries are excluded from initial installation. Previously researched version numbers in the evidence file are historical references, not active pins.

| Previous package | Decision and reason |
| --- | --- |
| `next` | Removed: React Vite SPA is the selected frontend; Fastify provides the API. |
| `react-is` | No direct requirement when Recharts is not selected. |
| `@tailwindcss/postcss` | Replaced by the Vite Tailwind integration. |
| `postcss` | No direct pin needed for the selected Vite integration; parent packages manage any transitive dependency. |
| `next-intl` | Replaced by i18next and react-i18next for the selected React SPA. |
| `tw-animate-css` | Deferred: optional component animations are not a confirmed feature. |
| `react-hook-form` | Deferred: four lead fields can use native React form state and shared Zod validation. |
| `@hookform/resolvers` | Not needed without React Hook Form. |
| `@tanstack/react-table` | Deferred: server pagination, filters and a semantic table cover the initial lead list. |
| `recharts` | Deferred: reporting requires summary cards and tables; charts have not been requested. |
| `read-excel-file` | Selected and installed at 9.3.12 for XLSX import worker; moved out of deferred scope. |
| `papaparse` | Selected and installed at 5.7.0 for CSV import and formula-safe CSV export. |
| `@types/papaparse` | Selected and installed at 5.5.2 for compile-time CSV declarations. |
| `vitest` | Not selected: use the built-in Node test runner for server/domain rules initially. |
| `playwright-core` | No direct pin: the selected Playwright test package manages its browser tooling dependency. |
| `@axe-core/playwright` | Deferred accessibility audit helper; not required for the first browser flow checks. |
| `eslint` | Replaced by one Biome formatter/linter setup. |
| `eslint-config-next` | Removed with Next.js; no Next lint rules are needed. |
| `prettier` | Replaced by one Biome formatter/linter setup. |

Initial reporting can use summary cards and semantic tables with server-side filtering and pagination. Charting and advanced column controls become separate decisions if users need them. Keeping these out of the first implementation does not remove the agreed reports or report filters.

Excel/Google Sheets data exists, but the company's sheet is unavailable. Generic XLSX/CSV import now supports mapping, server validation, preview, explicit duplicate review and original dates; exports use Excel-compatible CSV. Three exact parser dependencies were reverified against official latest tags before installation, bringing direct project dependencies to 35. Import creates New unassigned enquiries. Historical closed records or additional source columns need review when the actual file is supplied. Google connections remain disabled.

## Services and infrastructure that are not core installs

Google Cloud Translation Advanced v3 standard NMT remains the selected future external translation service, with all connection work explicitly deferred. Its SDK is pinned above and the user has created a Google Cloud project/free-trial account; do not initialize the SDK or configure the account in the current phase. The confirmed later policy is free-only usage within the eligible 500,000-character monthly NMT allowance, warning at 400,000 and pausing new calls before exceeding the remaining allowance. Paid continuation or changing providers requires a later user decision. This gate belongs to later integration work and is not deployed; Google's credit does not automatically stop API calls. See the cost and shared-allowance rules in [Requirements](requirements.md). [English and Arabic are supported](https://docs.cloud.google.com/translate/docs/languages).

Hosting, region and operating budget are not finalized. Google Cloud Run, Cloud SQL and Secret Manager are candidates, not mandatory architecture choices. PostgreSQL 18.6 is the selected portable database engine baseline; the database does not have to run in Google Cloud. Google Cloud CLI is conditional on selecting Google Cloud deployment and is not a mandatory development install.

The Google tag is measurement configuration, not a prerequisite for capturing a submitted lead. Configure it if Google Ads conversion measurement is enabled. Distinguish an enquiry-submitted event from the CRM's Converted status, which means confirmed booking/service.

A separate Google Scheduler service is not required for the agreed in-app follow-ups. Initially the API can derive due/overdue items from stored dates when the open CRM requests or refreshes them. Assignment/reassignment notification records are written with the corresponding change. Unattended delivery while the app is closed is not an agreed first-version notification requirement.

No Redis, message broker, microservice system, GraphQL layer, separate global state library or Google Ads API SDK is selected. Reconsider an additional service only when a specific requirement or measured bottleneck warrants it. Production hosting must still supply appropriate shared request limits, secrets, backups and recovery; the mechanisms are deployment decisions.

## Runtime and database versions

| Tool | Verified version | Release status |
| --- | --- | --- |
| [Node.js](https://nodejs.org/dist/index.json) | 26.12.0 | Latest Current development target; not LTS at verification time. |
| [PostgreSQL](https://www.postgresql.org/support/versioning/) | 18.6 | Latest stable engine baseline; PostgreSQL 19 RC is excluded. |

[Node.js recommends LTS for production](https://nodejs.org/en/about/previous-releases). The Node 26 target is installed for development; production requires actual LTS availability and revalidation, or an explicit revised runtime decision. The older machine-wide Node installation remains separate. Project activation selects the user-level Node 26.12.0 and pnpm 12.14.0 installations.

## Installation and dependency rules

1. The user authorized installing the 32 selected runtime/development packages as the initial baseline before CRM feature implementation. Each entry records its installation scope, Codex usage and later feature stage. Future additions require their mapped feature/tooling need. Excluded or conditional entries are not an installation checklist.
2. Before installation, run node scripts/check-toolchain.mjs and recheck current stable releases. Update the exact snapshot and documentation together when selecting a newer release. This dated baseline is not permanently latest.
3. package.json contains the 32 exact application/development dependency pins and packageManager pnpm@12.14.0. Do not use floating tags, version ranges, prereleases or silently downgraded fallbacks. pnpm 12 reads exact-save, strict engine/peer and error-on-runtime-substitution policies from pnpm-workspace.yaml; .npmrc provides npm fallback settings. Use the preinstall guard and `inaya.cmd` wrapper, and run `check:dependencies` to verify the real executable, version-file agreement and singleton React modules.
4. The real pnpm-lock.yaml has been generated and its frozen install verified. Commit it with the source and use frozen-lockfile installs in CI/deployments. The research snapshot is not a package-manager dependency lockfile. Parent packages can bring their compatible internal dependencies; do not install every transitive helper directly. A documented narrow esbuild override resolves an inherited migration-tool advisory; see the local setup document for rationale and validation.
5. Run node scripts/check-toolchain.mjs --runtime to verify the installed runtime; add --production for the LTS check. Record container image digests and actual database/provider versions when deployment is chosen.
6. Every new direct dependency needs a concrete feature, planned use and reason it is needed beyond the tools already selected. Recheck versions and relevant compatibility when adding it.

## Verification completed

All 34 selected package versions matched their live stable latest tags and were not marked deprecated. There were 40 passing Node-engine/selected-peer metadata checks, plus three passing compatibility declarations from the selected Fastify plugins' official release source. No advisories were returned for these direct versions by the npm bulk advisory endpoint at verification time. This does not audit the uninstalled transitive dependency tree.

Local installation subsequently passed: all 32 project pins, exact runtime selection, frozen dependency installation, module imports, Fastify validation/plugins, PostgreSQL application login and English/Arabic text round-trip, React/Vite/Tailwind dependency smoke build, TypeScript compilation and Drizzle migration generation. The final full dependency audit reported zero known vulnerabilities after the documented esbuild override. Three inherited deprecated helpers remain noted in the local setup document.

Those original checks established dependency readiness. The subsequent core release has now passed its real application build, PostgreSQL/API tests and connected Chromium workflows, including English/Arabic layouts. [Implementation status](implementation.md) records the verification scope. No live translation call has been made; production load/deployment checks remain separate.
