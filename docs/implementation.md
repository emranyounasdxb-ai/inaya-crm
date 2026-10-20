# Core CRM implementation

20 October 2026 — local completion release.

This is a real React/Vite interface connected to Fastify, Better Auth and PostgreSQL. Google connections remain disabled. The completion release adds three verified file-import dependencies; existing Node/React pins are unchanged. See [Remaining-work checklist](completion-checklist.md) and [Local operations](operations.md).

## Implemented

- Private first-admin setup with a random one-time bootstrap key. No default user/password and no public registration.
- Individual email/password sessions, password change with revocation of other sessions, admin account creation and activation/deactivation.
- Server-enforced roles: manager creates/assigns leads; assigned staff and managers add comments and update progress; admin/owner read all records and reporting. Admin manages accounts. Staff cannot list other members' leads or retrieve their details/comments/translation.
- Lead entry: required name, valid normalized phone and source; optional message. Pasting is supported. A duplicate normalized number requires explicit acknowledgement; no automatic merge.
- Assignment/reassignment to active staff, initial follow-up, optimistic version checks and transactional history. Old assignees lose API access immediately after reassignment.
- Status updates, mandatory lost reasons, an explanation for Other, and manager-only reopening to an active status with a reason. Active assigned leads always have a follow-up; closing clears it. Active stages can be selected directly; this is an initial implementation choice.
- Search, status/source/staff filters and server pagination (25 records per page). Today/overdue follow-ups use Dubai time.
- Dashboard counts and assignment notifications. Open screens refresh every 60 seconds. Due/overdue reminders are derived from current assignments and dates, and remain until rescheduled/closed; marking assignment notifications read does not dismiss an overdue lead. No closed-app/email/SMS/push delivery.
- Reports for today, yesterday, Monday-start week, month or custom Dubai date ranges, with source/status/staff filters. New enquiries use creation date and current assignee; first booking confirmations use confirmation date and the assignee then. First confirmation survives reopen/reassignment and is counted only once. No conversion-rate percentage. Lost-reason breakdown explicitly describes the currently lost records in the creation-date cohort. Live pending/overdue totals are on the dashboard/follow-up screens.
- Maintained English/Arabic labels and independent saved user preferences, mirrored RTL layout, unchanged source narratives/names/phones and no Google request.
- Manager edits customer name/phone/source/message with a reason, duplicate protection and previous/new values in history. Narrative source revisions advance for future translation cache correctness.
- Own-comment editing for staff/managers with revision checks and retained old text. Manager archive/restore is reversible; archived leads are excluded from live lists, reminders and reports, while authorized reviewers can view history.
- Admin role changes with self-lockout protection, open-assignment checks and session revocation. Administrator-issued 15-minute single-use password-reset links require the admin's current password; local operator recovery covers sole-admin lockout. Reset invalidates all sessions.
- Manager XLSX/CSV import with worker parsing, bounded files/rows, column mapping, server preview/validation, duplicates, historical dates, transactional commits and idempotent retry. Owner/admin filtered CSV export escapes spreadsheet formulas.
- Snapshot-consistent private local PostgreSQL backups, daily startup/hourly catch-up, owner/admin status and isolated restore exercises comparing table counts and content hashes.

The required-field, duplicate, reopening and reporting-date/attribution recommendations were explicitly accepted during implementation. Minute refresh, direct active-stage selection and first-confirmation deduplication are documented initial choices, not new claims about prior approvals.

## Start and first account

Open `start-crm.cmd` to activate the exact project tools, start the existing PostgreSQL cluster, apply pending reviewed migrations, build and run the application at `http://127.0.0.1:4310`. It uses only a process execution policy.

The initial setup link is generated in `.local/setup-link.txt`. Open it locally and enter the administrator's actual name, email and a password of at least 12 characters. The random setup key is carried in a URL fragment, removed from the address bar on load, and cannot create another first administrator after setup. Admin can then create the manager, owner and individual staff accounts. Share credentials privately; each user can change their password in My account.

`.local/app-secrets.json` and `.local/setup-link.txt` are ignored and restricted to the current Windows user and SYSTEM. Keep them private. Local binding is loopback only. Real customer data is not seeded; preview/test records live only in disposable test schemas.

After the initial build, `inaya.cmd dev` watches server code and serves the built client. Rebuild client changes with `inaya.cmd build`. For optional Vite hot reload, run the backend with `APP_ORIGIN=http://127.0.0.1:5173` and `PORT=4310`, and run `inaya.cmd dev:web` in a second terminal; use only the 5173 origin for that session. The default single-origin launcher needs neither setting change.

## Code and data

| Location | Responsibility |
| --- | --- |
| `src/shared/contracts.ts` | Input validation and stable role/status/source values. |
| `src/server/auth.ts` | Better Auth configuration and session creation gate. |
| `src/server/app.ts` | Same-origin API, authentication, role guards, notifications, reports and static serving. |
| `src/server/services/leads.ts` | Authorization-scoped queries, duplicate checks, assignments, status, comments and atomic history. |
| `src/server/services/accounts.ts` | Better Auth password hashing and transactional account provisioning. |
| `src/server/services/recovery.ts` | One-time hashed recovery tokens, password verification/reset, role changes and session revocation. |
| `src/server/services/import-export.ts` | Validated import previews/atomic batches and restricted formula-safe CSV export. |
| `scripts/backup.mjs`, `scripts/test-backup-restore.ps1` | Daily local backups and restore into a disposable database only. |
| `src/server/db/schema.ts`, `migrations/` | Auth/business tables, indexes, enum values, foreign keys and follow-up/loss constraints. |
| `src/server/integrations/` | Disabled provider-neutral ports retained for future Google adapters. |
| `src/web/features/` | Auth, overview, lead list/detail, team, reports and account screens. |
| `src/web/i18n/` | Maintained English/Arabic translations. |
| `src/web/styles.css` | Shared desktop styling, logical-direction layouts and RTL adjustments. |
| `tests/crm.test.mjs`, `tests/e2e/` | Actual PostgreSQL/API and Chromium workflows. |

Better Auth endpoints are explicitly allowlisted. Database-backed sessions are rechecked against active users on every protected request; privileged role fields are not user-editable. HTTP-only SameSite cookies, same-origin JSON writes, request limits, CSP/security headers and non-cacheable API responses are enabled. SQL values are parameterized, React renders narrative text as text, and server errors/logs do not expose submitted passwords or database connection strings.

Lead writes lock records and check their version. Duplicate phone checks serialize per normalized number. Assignment/status/history changes commit together. A detail read uses a consistent database snapshot so concurrent reassignment cannot expose a new comment fetched after the initial access check.

Biome handles formatting and linting; its Tailwind parser is enabled. CSS descending-specificity warnings are disabled because the stylesheet contains separate component selectors and intentional component overrides; JavaScript/TypeScript correctness and accessibility rules remain enabled.

## Verification and limits

Run `inaya.cmd build`, `inaya.cmd lint`, `inaya.cmd test:crm`, `inaya.cmd test:e2e`, `inaya.cmd check:integrations`, `inaya.cmd check:dependencies` and `inaya.cmd audit`. Database tests create random `inaya_test_*` schemas and delete only those namespaces. The E2E server uses port 4311, generated disposable credentials and matching Playwright Chromium. Screenshots are private local preview artifacts, not real business records.

Tests cover role/record isolation, closed registration and role escalation attempts, CSRF/origin rejection, required fields, normalized duplicates, concurrent/stale saves, reassignment, lost/reopen rules, immutable conversion credit, language isolation, deactivation/session revocation, browser lead entry/assignment/comments/updates, RTL and safe literal display of script-like text.

The initial release passed 19 automated tests. The completion release expands coverage for editing/history, archives, roles, concurrent single-use recovery, import transactions/idempotency, CSV safety and actual browser file handling. Current final results are recorded in [Completion report](completion-report.md). Reviewed additive migrations preserve existing records; test data stays in disposable schemas.

The user explicitly postponed hosting. Production HTTPS, LTS runtime revalidation, encrypted off-device backups/retention and deployment-specific security review remain future work. Local backup/restore and password recovery are implemented. Email delivery is optional because the current recovery workflow uses privately shared links. No hosting has been provisioned.

Google translation/capture/Ads remain deferred; original narratives are shown. Permanent deletion is disabled by confirmed policy. Actual historical-sheet migration awaits the company's file and decisions for closed historical records/additional columns. A generic system-configuration console is outside the agreed scope; current role, language, password and backup-status settings have dedicated screens. The local app is not a guarantee of zero vulnerabilities or production approval.
