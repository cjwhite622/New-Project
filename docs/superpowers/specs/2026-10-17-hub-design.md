# The Hub design

## Intent and scope

The owner wants a downloadable, local-first organization of cloud-powered agents. The human reviews decisions and discusses ideas. Preserve the attached vision in `docs/original-vision.md` as product requirements, not as instructions that override this development session. This release implements Phase 0 and Phase 1, in order. Later phases remain explicit gates requiring actual business connections and evidence. No simulated revenue, silent purchases, or implied income guarantee.

## Improvements to the brief

- Durable, idempotent jobs and events prevent retries from duplicating records. An interrupted cloud job becomes failed with an explicit unknown-outcome message; it is never silently replayed.
- Reserve a maximum call cost before dispatch. Count actual usage, reservations, agent limits, the API budget, operating budget, and hard ceiling before each cloud call. At 80% use a cheaper tier; at 100% pause. Do not automatically retry a paid request after ambiguous transport failure.
- Approval binds to a versioned immutable payload. Edits create a new review and invalidate approval. Guardian can veto a task. Approval is authorization, never evidence that an unavailable integration executed an action.
- Store Life Coach data in a separate SQLite database with a separate service and no business-agent access. Do not include personal content in business audit, exports, prompts, or analytics.
- Store desktop keys using the OS credential encryption supplied by Electron. If encryption is unavailable, accept session-only secrets and say so. Never place keys in renderer storage, logs, exports, or source files.
- Use integer cents for finance. Manual and CSV records remain unverified. Distinguish recorded revenue from independent settlement evidence. Tax reserve is an owner-configured estimate, not jurisdiction-specific tax advice.

## Architecture

React and TypeScript render a local dashboard. An Express loopback server owns SQLite, a serialized event-driven job worker, approval policy, a provider registry, finance calculations, CSV import, audit exports, and a private personal service. Node 24 provides SQLite without a native dependency. Electron packages the same production UI and server into a Windows installer. Browser development uses a same-origin Vite proxy.

The renderer receives a session capability from the desktop launch URL, exchanges it into session storage, and removes it from the URL. Every API request requires this capability. Development uses a local bootstrap endpoint restricted to the Vite origin and loopback hosts. CSP, origin checks, small request limits, no remote navigation, and disabled renderer Node access protect the local service. Production binds only to 127.0.0.1 on an ephemeral port.

The business DB holds owner profile, configuration, agent settings, tasks, structured events, approvals, immutable ledger records, cache, usage reservations, and a hash-chained audit. The personal DB holds only private interview answers and notes. Both live outside the installation directory. Backups use SQLite's backup operation into a downloadable archive including private data only on an explicit personal export.

## Interfaces and behavior

`createHub({dataDir, vault, fetchImpl})` supplies storage-backed domain operations. `createApp(hub, {token, development})` exposes validated JSON routes. Provider adapters cover OpenAI Responses, Anthropic Messages, and Moonshot's OpenAI-compatible endpoint. Models and token prices are editable because provider catalogs and rates change. Calls use bounded output, measured usage, timeouts, and provider-supported prompt caching. Results also use a local exact-match cache. An unconfigured provider blocks rather than fabricating an answer.

Onboarding is a resumable Manager conversation. It captures identity, goals, timeline, hours, startup budget, monthly operating/API/hard budgets, risk, jurisdiction, currency, stage, model, offer, assets, and brand. Recommendation mode offers explicit selectable models; the owner chooses. The confirmation summary must be accepted before agents activate. Technical connection setup is then available with contextual guidance.

All sixteen agents and six business playbooks ship as JSON. Config includes mission, duties, model tiers, permissions, triggers, escalation rules, token budgets, and KPIs. Phase 0/1 executable tasks are daily digest, budget review, Guardian local scan, tax estimate, and cloud-assisted business drafts/ideas. Later agents remain visible with readiness labels. No general-purpose code execution or public-action adapter is exposed in this release.

Finance supports atomic validated manual entry, CSV preview/import with stable row identifiers, duplicate prevention, full-history ledger and monthly P&L, tax reserve, per-agent usage, time records, and evidence-aware proof export. All monetary values are one owner-selected currency. Provider rates are USD; cloud inference is gated to USD profiles until an explicit exchange-rate policy exists.

## Validation and release gate

Automated tests cover interview persistence and activation, duplicate jobs, approval replay/edit races, kill switch abort, spend reservation under concurrency, 80/100% token limits, local cache, recorded usage, malformed provider responses, CSV atomicity and deduplication, budget restrictions, month boundaries, audit chain checks, private-data isolation, authorization and origin checks, and backup recovery. A browser test completes onboarding and exercises approvals, tasks, finance, private notes, settings, and reload. Build the renderer and Windows NSIS artifact when the toolchain is available. Document what is built, tested, unverified, and gated.
