# Inaya CRM

Inaya CRM is an internal lead management and reporting system for Inaya Domestic Workers. The business has one team and approximately 20 people. Staff will use the CRM on laptops and desktop computers.

The local CRM includes individual login/recovery, roles, manual leads, assignments, editable details/comments with history, archive/restore, statuses, follow-ups, reports, spreadsheet import/CSV export, local backups and English/Arabic layouts. [Implementation and verification](docs/implementation.md) records the delivered scope; [Local operations](docs/operations.md) explains import, recovery and restore-tested backups. Hosting and Google connections are explicitly postponed.

Open `start-crm.cmd` to start the database, apply reviewed migrations, build and run the CRM at `http://127.0.0.1:4310`. On the first run, open the private `.local/setup-link.txt` link to create your administrator account. No default password or real customer data is seeded.

The confirmed workflow and remaining decisions are recorded in [Product requirements](docs/requirements.md). The selected tools and exact version baseline are in [Technology stack](docs/technology-stack.md) and [toolchain.lock.json](toolchain.lock.json).

The audited architecture is a React + Vite frontend and Fastify REST API with PostgreSQL. [Dependency contract](docs/dependencies.md) lists every package's exact version, purpose, how Codex will use it, and the one-runtime/one-React rules. The stack document identifies excluded and deferred tools separately.

Google connections are deferred. A [provider-neutral integration foundation](docs/integrations.md) is implemented with disabled defaults, original-text fallback and an inactive external capture port; it exposes no public capture route and requires no Google credentials. Run `inaya.cmd check:integrations` for its type check and focused tests. Manual CRM features and English/Arabic interface labels work independently of later Google adapters.

Local Windows tools and the exact project dependencies are installed. See [Local development setup](docs/local-development.md) for activation, database controls and verification commands. Open [dev.cmd](dev.cmd) to start a development PowerShell session that selects the installed versions and starts PostgreSQL. This launcher uses a session-only policy for local scripts without changing the saved system policy.

Check whether the recorded tools still match official latest stable releases with `node scripts/check-toolchain.mjs`. This read-only check does not install dependencies. Runtime installation and production LTS checks are documented in the stack file.

Use `inaya.cmd check:installation` from any directory to select the project Node/pnpm and run all dependency checks (the database must already be running). `inaya.cmd check:dependencies` is the quick offline check for exact pins, Node consistency and duplicate React modules. The dependency contract records the completed refresh and remaining upstream limitations.
