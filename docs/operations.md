# Local operations and recovery

Updated 20 October 2026. Hosting is explicitly postponed; the local CRM binds only to `127.0.0.1:4310`.

## Start and use

Open `start-crm.cmd`. The launcher selects the pinned Node/pnpm/PostgreSQL tools, starts the existing cluster, applies reviewed additive migrations, builds and starts the app. Do not launch a second copy while port 4310 is already occupied.

Admin creates individual accounts from Team. Manager creates and assigns enquiries, edits details with a reason, and archives/restores records. Staff update assigned enquiries and may edit their own comments. History retains previous text. Owner/admin export matching lead rows from Leads. Permanent deletion is deliberately unavailable.

Archived records are hidden from staff, normal lists, reminders and reports. Managers, admins and owners can select **Archived** in the lead visibility filter. Managers restore with a reason; an assigned open enquiry requires an active staff assignee and a new future follow-up. If the assignee was deactivated, reactivate them before restore, then reassign if needed.

Changing another person's role revokes their sessions and outstanding reset links. An administrator cannot change their own role or deactivate themselves. Open assignments, including archived open enquiries, must be reassigned before a staff member changes role. Deactivation is allowed immediately for security; managers must reassign any remaining open enquiries.

## Forgotten passwords

1. An administrator opens Team → the person's **Issue password reset link**.
2. The administrator verifies their own current password and privately shares the displayed link with that person.
3. The link expires after 15 minutes, works once, and a newer link replaces the older one.
4. Resetting changes the credential and revokes all existing login sessions. The person signs in again.

No email provider is required; the app does not send the link automatically. Links carry tokens in the URL fragment, remove that fragment after loading, and store only token hashes in the database. Never paste a reset link into tickets, shared documents or logs.

For a locked-out sole administrator, a trusted operator on this Windows account can run:

```powershell
.\inaya.cmd recover:account administrator@example.com
```

Use the actual existing active administrator email. Open the private `.local/recovery-link.txt` file locally. This command uses existing OS/database authority, does not create a default account and does not print the secret token.

## Spreadsheet import/export

Manager → Leads → Import leads. Choose UTF-8 CSV or XLSX, first worksheet only, with a header row, at most 500 data rows/100 columns and 2 MB. Workbook ZIP metadata is checked for a 20 MB expanded-size limit; parsing runs in a terminable browser worker with a 10-second timeout. Use company workbooks; encrypted workbooks, legacy `.xls`, macros and formula evaluation are unsupported. Save `.xls` as `.xlsx` or `.csv` first.

Map customer name, phone and source; optionally map message and original creation date. Source codes are `google_ads`, `whatsapp`, `call`, `facebook`, `instagram`, `website`, `referral`, `other`. Source codes are shown in the bilingual UI. Phones are normalized with UAE as the default country.

Use `YYYY-MM-DD` or an ISO timestamp for original dates. Date-only cells use midnight in Dubai. Actual Excel date cells are treated as calendar dates; to preserve a time, provide an ISO timestamp as text. Future/invalid dates are rejected. Leaving the date column unmapped uses the import date and is appropriate only when original dates are unavailable.

Review every row. Invalid rows cannot be selected. Duplicates start unchecked; selecting a duplicate explicitly creates a separate enquiry. The server rechecks duplicates when committing, so a concurrent new enquiry may require validating again. A batch either commits fully or rolls back. Retrying a completed batch returns its original result without duplicating leads. Previews expire after 30 minutes; that manager's previews older than seven days are removed on the next preview.

Imported rows start New and unassigned. Existing closed statuses, historical staff attribution or additional columns require mapping decisions after the company's actual sheet is supplied; do not import closed history as new work without that review. No Google Sheets synchronization or automatic platform capture is active.

Owner/admin export UTF-8 CSV, opened by Excel, for the current lead filters (up to 10,000 matching records, all pages). Export includes messages and dates, so keep downloaded files private. Formula-triggering cells are prefixed with an apostrophe to protect spreadsheet opening; this also applies to `+` phone numbers. Export is CSV, not a formatted `.xlsx` workbook. The import phone parser accepts the protective apostrophe before a `+` number.

## Backup and restore verification

The local server checks at startup and hourly, saving at most one automatic backup per Dubai calendar day. If the app/computer was stopped, it catches up when next started. It does not run while the computer is off. Owner/admin can see last successful backup, last restore exercise and last-attempt failure in My account.

Private location: `%USERPROFILE%\.inaya-crm\backups`. Access is restricted to the Windows account and SYSTEM. Each backup consists of:

- A PostgreSQL custom-format `.dump` containing public CRM and migration schemas. Disposable test schemas are excluded.
- A `.manifest.json` with a SHA-256 archive checksum and snapshot-consistent table row counts/content hashes.
- A matching `.app-secrets.json` when local auth configuration exists.

These files contain sensitive business/authentication data. Local copies use filesystem permissions, not separate file encryption. An encrypted separate-device destination and retention policy will be selected with hosting; local copies do not protect against loss of this disk. No automatic deletion of existing backups is performed.

```powershell
.\inaya.cmd db:backup
.\inaya.cmd db:restore-test
```

The restore exercise verifies the archive checksum, creates a uniquely named `inaya_restore_test_<32-hex>` database, restores only into it, compares every table's count and content hash against the saved snapshot, and drops only that disposable database. It never restores over `inaya_crm`.

For a real disaster recovery: stop the application, preserve the damaged database and backups, verify a chosen archive with the isolated exercise, provision a separate replacement database with appropriate application-role privileges, restore there, and validate before switching `DATABASE_URL`. Restore the matching auth secret only from private storage, or deliberately rotate it and invalidate old sessions. Do not run a destructive restore against the live CRM as a test. Connection secrets/DPAPI files are machine-specific and must be provisioned privately on a replacement host.

## Later deployment

The user confirmed local completion first. Hosting/domain, HTTPS, production LTS runtime revalidation, a managed service/process supervisor, an encrypted off-device backup destination/retention schedule and deployment-specific security checks remain future work. Keep loopback binding and do not expose local port 4310 directly to the internet. Google APIs, billing, public capture and machine translation remain disabled until separately resumed.
