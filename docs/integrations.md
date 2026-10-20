# Deferred integrations and core application boundaries

Confirmed on 20 October 2026: defer all Google connection work until the user returns to it. Build the CRM so local login, role checks, manual lead entry/assignment, status, comments, follow-ups, reports and maintained English/Arabic interface text do not depend on a Google account or network request.

## Current foundation scope

Provider-neutral TypeScript contracts and a disabled integration factory are implemented under `src/server/integrations`. The core CRM now composes this factory in `src/server/app.ts`; an authenticated, lead-authorized translation endpoint returns the original with `not_configured`. There is no public capture route. The module's own tests verify that no Google configuration is required and disabled capture cannot create a lead.

Do not connect the existing Cloud account, enable an API, create credentials, deploy resources, change billing or install a Google CLI/Ads SDK. The previously selected Translation SDK stays pinned and installed, but the disabled foundation does not import or initialize it. The earlier free-allowance decision remains the condition for later activation, not work to perform now.

| Capability | Current behavior | Future connection boundary |
| --- | --- | --- |
| Staff login and roles | Local CRM email/password sessions; no Google dependency | Application auth and authorization remain separate from integrations. |
| Manual leads | Implement manager entry through the core lead workflow | Google connection must not change the existing lead identity, stages or access rules. |
| Customer form / Google Ads capture | Disabled public ingress contract; no public route exposed by the foundation | Owned enquiry form passes a validated submission into the same core lead-creation service. Google Ads sends visitors to this form; capture itself needs no Google Ads API SDK. |
| Campaign attribution | Optional provider-neutral type, including UTM fields and optional click identifiers | Save available attribution when a future public form submits; missing attribution does not invalidate a manual lead or invent a source. |
| Narrative translation | Return original text with an explicit not-configured result | A later server adapter implements the same translation port; UI consumes the stable result contract. |
| Fixed interface language | Implement English/Arabic labels and RTL/LTR locally | No machine translation API is required for interface labels or changing direction. |
| Ads conversion measurement | Disabled; no tag injection | A later measurement adapter consumes an intentional event. Enquiry submission and booking conversion remain separate events. |
| Existing Google Sheets data | No Google account connection or continuous sync | Import from a supplied file after its schema is reviewed; no Google OAuth requirement for core development. |
| Cloud hosting | No Google hosting dependency | Standard application/database configuration; deployment vendor stays undecided. |

## Configuration

The application foundation defaults to:

```dotenv
TRANSLATION_PROVIDER=disabled
PUBLIC_ENQUIRY_CAPTURE_ENABLED=false
GOOGLE_ADS_MEASUREMENT_ENABLED=false
```

These are server settings, not browser-exposed `VITE_*` secrets. Omitted settings have the same disabled defaults. Any attempt to enable these integrations currently fails with a clear deferred-setup error rather than activating an incomplete connector. Stray Google credential environment variables do not activate anything. The factory does not require or read Google credentials; keep real secrets out of `.env.example` and source control.

Future implementation must wire and verify an adapter before allowing its enabled setting. Changing a flag alone is not a completed connection. Manual CRM functions must continue to work with all integrations disabled.

## Contracts and data ownership

The core CRM owns lead IDs, customers, status, assignee, comments, follow-up dates, audit history and authorization. An external capture adapter submits input through that core service; it never writes arbitrary records directly, grants roles or changes report totals independently. A future valid public submission creates a New, unassigned lead in one transaction with attribution and ingestion history.

Reserve optional attribution and external submission references in the future core schema. Use an ingestion key to prevent the same submitted request being written twice; this is distinct from business duplicate review for a customer who makes another enquiry with the same phone number. All outside input needs runtime validation, server-owned source attribution, abuse controls and error handling before a route is exposed. TypeScript interfaces alone do not validate HTTP requests or authenticate their source.

Keep original narrative text in the core record. The translation request identifies a record/field, source revision and target language. A future separate cache uses that identity to avoid stale or cross-language results. Only narrative text is translated; names, phone numbers, IDs and timestamps remain unchanged. The disabled provider returns original content and never labels it as translated. Existing authorized cached translations may later be served without a provider call.

The future Google adapter belongs under `src/server/integrations/google`; it handles provider credentials and SDK requests. The composition factory is the place to wire that adapter to the existing ports. The core release now includes optional attribution/ingestion fields and original-text revisions in its reviewed business migration. A translation cache and external ingress implementation still need additive migrations/services in the later integration phase.

## Later activation checklist

When the user resumes Google work, verify the linked project/account and eligible remaining NMT free allowance, then configure server credentials and the agreed cost gate: warn at 400,000 monthly characters and pause new calls before exceeding the eligible 500,000-character allowance. Account for shared allowance use, concurrent calls, retries and the provider billing period. Paid continuation remains unauthorized. Google billing alerts alone do not enforce the cap.

Implement and test the real translation adapter, error/original-text behavior and cache invalidation before enabling it. Separately validate the public enquiry form, New/unassigned creation, request idempotency, attribution, permissions and abuse controls before enabling public capture. Configure Ads measurement only after its events are agreed. None of these later steps requires replacing the core CRM architecture, though adapter wiring and additive configuration/migrations will still need implementation and verification.

## Verification

`inaya.cmd check:integrations` type-checks the foundation and runs focused tests for disabled defaults, original-text fallback, isolated user language requests, disabled lead capture and rejected premature activation. These checks require no database, Google credentials or cloud access. They do not claim a live integration or an implemented CRM screen.

Verified on 20 October 2026: the strict TypeScript check and all five focused tests passed; the installed dependency consistency check also passed. The complete installation check now includes this foundation check. No new dependency, account connection, live cloud call or database migration was required.
