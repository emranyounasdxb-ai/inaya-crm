# Remaining-work checklist

Requested 20 October 2026: list outstanding work, implement it step by step, verify it, and deliver a final report.

| Step | Work | Status |
| --- | --- | --- |
| 1 | Manager edits lead details; preserve history and duplicate checks | Complete; API/browser verified |
| 2 | Recover a forgotten password without Google/email dependency; invalidate old sessions | Complete; expiring, concurrent single-use reset verified |
| 3 | Admin changes existing roles safely; prevent self-lockout and orphaned assignments | Complete; authorization/session checks passed |
| 4 | Edit own comments with revision history; reversible lead archive/restore | Confirmed by user and complete; history/visibility verified |
| 5 | Spreadsheet import preview/mapping/duplicate review and owner/admin export | Complete for XLSX/CSV input and CSV export; actual company sheet still unavailable |
| 6 | Private local database backups, automatic catch-up and isolated restore exercise | Complete; 11 tables restored with matching counts/content hashes |
| 7 | Regression/security/browser tests, documentation and running-app update | Complete; 29 tests, build/lint, installation checks and audit passed |
| 8 | Team HTTPS hosting and separate-device backups | Explicitly postponed by user; preparation in operations guide |
| 9 | Google translation/capture/Ads | Deferred by prior explicit instruction |

No production database will be reset. Existing people, sessions and leads must be preserved by additive migrations. Permanent deletion stays unavailable unless explicitly requested later. Current local release stays available while changes are prepared; one controlled restart will load the completed version.

Recovery will use an administrator-issued, short-lived single-use link, shared privately by the administrator. No password is sent by email or generated as a shared default. A local operator recovery command will cover a locked-out sole administrator using operating-system access.

Import will use a supplied file, preview, validation and explicit duplicate choices; it will not connect Google Sheets. Existing historical dates must be preserved when mapped. Actual company-sheet migration still requires the user's sheet.

See [Completion report](completion-report.md) for results and [Local operations](operations.md) for use, exact import limits, recovery and backup instructions. No permanent deletion, Google connection or hosting was enabled.
