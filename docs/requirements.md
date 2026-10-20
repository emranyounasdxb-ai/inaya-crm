# Inaya CRM product requirements

Updated: 20 October 2026

Latest scope decision: all Google account connections, Ads configuration/measurement, live public capture and Google-powered translation are deferred at the user's request. Build the core CRM and integration boundaries first; no Google credentials or account work are prerequisites for coding. [Deferred integration foundation](integrations.md) defines the prepared contracts, disabled defaults and later activation steps.

Inaya Domestic Workers needs one place to capture enquiries, assign leads, record follow-ups and review results. The first version focuses on lead management and reporting for one internal team. The business has approximately 20 people; the number of login accounts per role remains to be confirmed.

## Supported devices and language

Staff will use the CRM on laptops and desktop computers. Design lead tables, comments, assignment controls and reporting for those screens. Staff mobile layouts and a native mobile app are outside the current scope. Customer enquiry form device support remains a separate decision.

Support English and Arabic throughout the staff CRM, with a language choice for each user. The initial customer form language was English; whether it should also offer Arabic remains to be confirmed. Use +971 as the default phone country code while allowing other codes. Display reporting dates and follow-up times in Asia/Dubai. These are accepted configuration defaults; the business country and service cities still need confirmation.

## English and Arabic experience

Each staff member can switch between English and Arabic and retain their preference across sessions. English uses a left-to-right layout and Arabic uses a right-to-left layout. Changing one user's language must not change another user's language or update the underlying lead records.

Translate navigation, forms, buttons, validation messages, statuses, lost-reason labels, notification text, filters, dashboard labels and report headings. Use maintained interface translations for these fixed labels. Keep stable internal values for roles, statuses and source identifiers so that language selection does not change permissions, workflow or reporting totals.

In Arabic, adapt the sidebar, table layout, menus, alignment and directional controls to RTL. Handle mixed Arabic and English text correctly. Keep phone numbers, email addresses, URLs, record identifiers and tracking codes readable in their original format. Preserve customer and staff names as entered; transliteration is a separate, undecided feature. Language choice must not alter report periods, timestamps, numeric values or the Asia/Dubai reporting boundary.

### Translation of customer and staff text

After the translation integration is activated, the selected language applies to displayed lead requirements, customer messages, staff comments and other narrative text, including imported records. Staff can request a translation for individual text and access its original version. Mark machine-generated translations clearly. While Google work is deferred, keep original narrative text visible and return an explicit not-configured result; do not present it as a completed translation. English/Arabic interface labels and RTL/LTR remain part of the core CRM.

Preserve the original text and its language. Store translated versions separately, keyed to the record, field, target language and source revision. Reuse an existing translation when its source has not changed. Generate missing translations as authorized records are loaded or requested, with visible loading and failure states. A language switch must not initiate a rewrite or repeated translation of the entire database.

When someone edits original text, mark its old translation as stale and refresh it. If translation fails, show the original with a retry option. Saving a lead, changing a status or recording a comment must remain possible during a translation-service outage. Translating content does not broaden the user's access to records.

The user experience should present the CRM's text in the chosen language across accessible records; records that have not been loaded do not need to be translated synchronously before the interface can switch. This allows an English-speaking user and an Arabic-speaking user to work on the same lead simultaneously while sharing the same source data and history.

### Translation service and validation

Google Cloud Translation Advanced v3 is the selected service for automatic free-text translation, using the exact SDK version recorded in [Technology stack](technology-stack.md). Credentials and provider/account quota configuration are still required. Send only text needed for translation. API activation, integration and live translation have not been verified; an existing cloud account alone does not establish readiness. Personal billing and payment records belong outside the source repository.

Confirmed cost decision, 20 October 2026: use standard NMT text translation within Google's first 500,000 characters per month free allowance, then review the next step with the user. This is characters, not words, and a monthly allowance, not a lifetime allowance. Paid translation beyond that allowance is not authorized. Do not automatically change providers or upgrade to paid usage.

When the user resumes translation integration, implement a server-enforced monthly request budget before live use. Warn owner/admin at 400,000 characters and pause new provider calls before a request would exceed 500,000. Count all text sent, target languages and retries conservatively; reserve usage atomically for concurrent requests. Continue serving cached translations, show originals for untranslated text and keep the CRM usable when translation is paused. Owner/admin can then review whether to wait for the next billing-period allowance or authorize a different plan. Neither Google activation nor usage-budget implementation is part of the current disabled foundation.

Google's free allowance is a billing credit, not an automatic provider stop at 500,000. Its Basic/Advanced NMT credit is shared; verify the linked account's eligible remaining allowance and any other translation usage before live activation. Use a lower application ceiling if part of the allowance is already consumed. Align tracking with the provider's billing period and reconcile usage; an application-only counter or a budget alert does not by itself guarantee the provider bill. Request gating, accounting, alerts and provider settings are requirements still to be implemented. [Google Cloud Translation pricing](https://cloud.google.com/products/translate/pricing)

Validate both interface languages, mixed-direction messages, unchanged phone numbers, simultaneous users with different language preferences, unchanged report totals, translation refresh after edits, and loading/failure behavior before release.

Direction handling should follow [W3C guidance for RTL and LTR content](https://www.w3.org/International/questions/qa-html-dir.en.html). [Google Cloud Translation's language list](https://docs.cloud.google.com/translate/docs/languages) confirms English and Arabic support for the selected service.

## Roles and access

| Role | Confirmed responsibilities |
| --- | --- |
| Owner | View all leads, statuses, progress and reports. |
| Admin | View all leads and reports; create staff accounts and assign roles. |
| Manager | View all leads; manually create leads, assign and reassign them; monitor unassigned leads and team follow-ups. |
| Team member | View assigned leads, add comments, update statuses and manage next follow-ups. |

Use individual email and password accounts with public registration disabled. Admin can deactivate accounts while preserving their lead and activity history. Enforce lead visibility by role. Permissions to delete records, edit other people's comments, export data or change system configuration are not yet specified.

## Lead entry fields

The staff Add Lead form contains:

- Customer name.
- Phone number.
- Source, selected from a list such as Google Ads, WhatsApp, Call, Facebook, Instagram, Website, Referral and Other.
- Requirement or customer message, entered as free text.

The user specifically requested these four fields. Confirmed during coding: name, valid phone and source are required; message is optional. A normalized duplicate phone displays a warning and permits a separate enquiry only after acknowledgement. Support pasting text into the fields and requirement/message area. Automatic extraction from an entire pasted message has been discussed but is not a confirmed first-version requirement.

## Google Ads capture — deferred connection phase

Google Ads remains the planned first paid acquisition channel. Its account setup, connection, measurement and live capture are deferred. The current core phase uses manager-entered leads; manual entry can label a known source without connecting its platform. Prepare the provider-neutral submission/attribution contracts now. When the user resumes this phase, Inaya's own customer enquiry form is the planned ad destination:

1. A customer opens the enquiry form from a Google ad.
2. The customer provides their name, phone number and requirement/message.
3. A successful submission creates a lead with status New and no assigned team member.
4. The lead appears in the manager's Unassigned list.
5. The manager assigns the lead to a team member.
6. The team member records comments, changes status and schedules follow-ups.

Capture source and campaign attribution from the incoming tracking link when available. Do not invent attribution when it is missing. Opening the form or clicking an ad alone does not provide enough information to create an identified customer lead.

Manager enters leads from other platforms manually. Direct integrations with Meta, WhatsApp and other platforms are outside the initial integration scope. Native Google Ads lead-form ingestion is a separate future option, not the selected initial flow.

Google Ads account details, domain, hosting, attribution parameters and conversion measurement setup remain to be specified. No ad campaign has been created or connected.

## Lead stages

Use these stages as the initial pipeline:

New -> Contacted -> Follow-up -> Interested -> Converted / Lost

This describes the expected progression. Confirmed during coding: only a manager can reopen a closed lead and must provide a reason. The initial implementation permits selecting active stages directly and reopening to an active stage; a stricter transition policy remains a later business decision.

Converted means the customer's booking or service has been confirmed. An expression of interest alone is not a conversion. Advance payment and service start are not required to meet this agreed definition.

Marking a lead Lost requires one of these reasons:

- Price too high.
- Suitable worker unavailable.
- Customer chose another agency.
- Customer no longer needs the service.
- No response after follow-ups.
- Other, with a written explanation required.

## Assignment and history

The manager manually assigns and reassigns leads. Reassignment preserves the existing comments and status history. Record the reassignment in the activity history.

Record the responsible person and timestamp for comments and status changes. Team members can access their own assigned leads; manager, admin and owner can view all leads.

## Follow-ups and notifications

Each active assigned lead has a next follow-up date and time set by its team member. Show today's follow-ups and overdue follow-ups separately. The manager can see follow-ups across the team.

Close pending follow-up reminders when a lead becomes Converted or Lost. Provide notifications inside the CRM for assignment, reassignment and due or overdue follow-ups. Show unassigned and overdue leads on the manager's dashboard.

Email, SMS, WhatsApp and desktop push notification delivery are outside the initial notification scope. Notification timing and escalation rules remain to be specified.

## Reports

Provide these views:

- New lead totals.
- Pending and overdue follow-ups.
- Converted leads.
- Source performance.
- Team member performance.
- Lost leads grouped by reason.

Include Today, Yesterday, This Week, This Month and a custom date range. Provide filters for team member, source and status.

Confirmed during coding: new leads use creation date; booking confirmations use confirmation date and the staff member assigned then. Omit conversion-rate percentages initially. The implementation records the first confirmation once per lead, retaining that event through reopening/reassignment; new-enquiry staff grouping uses the current assignee. Lost-reason reports explicitly use currently lost records in the creation-date cohort. Ad spend and cost per lead reporting have not been agreed.

## Existing spreadsheet data

Existing leads are held in Excel and Google Sheets. A sample is not currently available.

The proposed migration is a one-time import with column mapping, a preview and duplicate review. Start with Customer Name, Phone, Source and Requirement / Message as the template. Map additional existing fields when a sample is available. Preserve historical dates and sources when supplied; do not label an import timestamp as the original enquiry date.

Match phone numbers after normalizing country codes and formatting, and flag potential duplicates for manager review. The same customer may have a new enquiry, so do not silently merge all records sharing a phone number. Import acceptance rules and whether to include closed historical leads still need confirmation. Continuous Google Sheets synchronization is not part of the current plan.

## Remaining decisions

The selected implementation architecture is React + Vite for the interface, a Fastify REST API, and PostgreSQL. Interface localization uses i18next + react-i18next; narrative translation uses Google Cloud Translation. See [Technology stack](technology-stack.md) for exact versions, feature mapping and tools deferred from initial installation.

- Business country and service cities.
- Exact number of staff accounts per role.
- Future public-form validation and handling incomplete public submissions; manual required fields are confirmed above.
- Whether the customer form must support mobile visitors independently of the desktop staff interface.
- Whether the customer form should also offer Arabic.
- Deferred Google translation phase: credentials and quota enforcement for the confirmed free-only 500,000-character monthly ceiling; any name transliteration or additional languages. Paid usage requires a later decision. These do not block core CRM implementation.
- Duplicate handling for future public submissions; manual duplicate warnings are confirmed above.
- Any stricter active-stage transition policy. Manager-only reopening with a reason is confirmed. Comment editing and reversible archive rules are confirmed below.
- Any conversion-rate formula or changed metric definitions; current reporting is defined above. The first implementation refreshes open-screen notifications every 60 seconds; escalation and closed-app delivery remain unspecified.
- Deferred Google Ads phase: account, attribution and conversion measurement. Domain, logo and customer-facing business/contact information are needed before a public launch, not the disabled foundation.
- Spreadsheet structure and migration acceptance rules when data is available.
- Hosting provisioning and region, production runtime LTS readiness, off-device backup destination/retention and operating budget. Local backups and isolated restore verification are implemented; hosting is explicitly postponed. Selected tools and version rules are recorded in [Technology stack](technology-stack.md).

Confirmed completion rules: managers edit lead details and archive/restore with reasons; staff/managers edit only their own comments while retaining prior values in history; owner/admin export; permanent deletion stays disabled. Admin-issued single-use password recovery requires no email provider. Generic XLSX/CSV import is implemented; real company data migration still requires the sheet. See [Local operations](operations.md) for exact limits and [Implementation status](implementation.md) for verification. The user explicitly confirmed completing local features now and hosting later; Google connections remain deferred.
