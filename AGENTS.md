# Inaya CRM project instructions

Read `docs/requirements.md` and `docs/technology-stack.md` before implementation. Confirmed workflow decisions and pending business details are separated there.

Read `docs/implementation.md` for the implemented local release and verification commands. Keep new work compatible with the actual role/lead rules; do not replace the working app with mock data. UI/API tests use isolated disposable database schemas; never seed test records into the real CRM. The first administrator is user-created using the private setup link.

Read `docs/dependencies.md` before dependency work. It defines every selected package's purpose, Codex usage, exact version and installation scope. Use `inaya.cmd` or activate the configured project tools before commands. Run `check:dependencies` to reject version drift, duplicate React modules and unexpected Node paths; do not bypass failures or use app-bundled/machine Node for this project.

## Dependencies

- Use the exact selected versions in `toolchain.lock.json`; verify current official releases before installing. Run `node scripts/check-toolchain.mjs` to detect stale version decisions. Research and update the snapshot and documentation together when new stable releases are selected.
- Do not copy old versions from tutorials or Context7 examples. Official npm release metadata and official runtime/database release feeds decide version numbers; documentation guides API use.
- Use stable, non-deprecated releases. Do not silently select beta, RC, canary, incompatible packages or older fallbacks.
- During application setup, use exact manifest versions, the selected pnpm package manager, and a committed `pnpm-lock.yaml`. Do not claim `toolchain.lock.json` is a complete installed dependency lockfile.
- The selected Node 26 runtime is Current at the recorded verification time. Follow the production LTS rule in the stack document; do not describe it as LTS or deploy it as production without resolving that rule.
- Package metadata checks do not replace an application build, relevant workflow checks or a transitive dependency audit.
- Each selected dependency must have a concrete feature, planned code location and implementation stage in `toolchain.lock.json`. Do not add a library merely because it is popular or might become useful.
- The selected architecture is React + Vite with a Fastify REST API, served on the same origin. Next.js and Next-specific packages are no longer selected. Use i18next + react-i18next for interface languages.
- Hosting vendors, optional report charts and advanced table controls are conditional decisions. Do not treat deferred or excluded entries as installation requirements. Install feature dependencies when that feature is implemented.
- Use one Biome lint/format setup, TypeScript type checking, Node's built-in test runner for initial server rules, and Playwright for connected browser workflows. Do not add overlapping quality tools without a demonstrated need.
- Read `docs/local-development.md` for the installed Windows toolchain. Dot-source `scripts/activate-dev.ps1` before package commands so the project's Node and pnpm take precedence over inherited machine or Codex tools. Use `scripts/dev-shell.ps1` when the local database must also start.
- pnpm 12 project policies live in `pnpm-workspace.yaml`. Preserve its narrow esbuild advisory override and reviewed build-script policy until the parent dependency removes the need; revalidate migration generation if changing them.
- `.env.local` and `.local/` are private local state. Never print database passwords, expose their connection string or commit them. Use the database helpers; do not reset or delete an existing cluster to make setup pass.

## Product behavior

- Google connections are explicitly deferred. Read `docs/integrations.md`; keep translation/public capture/Ads measurement disabled, require no Google credentials for local CRM work, and do not enable APIs, billing, credentials or hosting until the user resumes that work. Use the provider-neutral integration contracts so later adapters do not replace the core lead workflow.
- Support English/LTR and Arabic/RTL per user. Preserve original business text and store translated copies separately. Locale changes must not overwrite source records, alter another user's settings or change report totals.
- When the user resumes Google integration, Translation standard NMT is free-only initially: verify the eligible shared monthly allowance, warn at 400,000 characters and gate new provider calls before the remaining 500,000-character allowance is exceeded. Implement atomic accounting and preserve cached/original text when paused before enabling live requests. Do not assume Google billing stops automatically or enable paid continuation/provider replacement without a later user decision. These controls belong to the deferred phase and are not implemented yet.
- Enforce role and lead access rules on the server. Staff see assigned leads; managers assign leads; owner/admin review all leads and reporting.
- Google Ads website-form submissions create New unassigned leads. Other sources use manager entry. Do not assume unrelated platform integrations or paid cloud resources already exist.
