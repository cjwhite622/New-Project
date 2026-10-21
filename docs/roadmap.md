# Requirements and next gates

The attached vision is broader than a first release. The implementation follows its order by building the local foundation and recorded money visibility first. Live integrations and income proof cannot be accepted without actual accounts, authorization, transactions and source evidence.

| Phase | Implemented in this release | Gate still outstanding |
| --- | --- | --- |
| 0 · Foundation | Interview, owner profile, SQLite, jobs, event log, three provider adapters, local routing, caching, budget reservations, dashboard, pause/recovery | Live provider-key/model test; scheduler/batch runner, webhook ingestion, rate-limit queue and optional Ollama |
| 1 · Money visibility | Manual entry/import, integer cents, P&L, cost estimates, provisional reserve, review time, evidence export | Reconciliation against real payment/bank statements; actual owner income/cost entries |
| 2 · First revenue loop | Commerce roles, six playbooks, draft work, versioned review and Guardian inspection | Tested store/supplier/customer-service adapters; real researched offer → approved listing → paid order → fulfillment → support |
| 3 · Attention | Private content draft workspace and review | Official publishing, social research data, media rendering pipeline, schedules, engagement and traffic attribution |
| 4 · Monetization/portfolio | Role definitions, zero default high-risk allocation, explicit opt-in planning cap | Monetization APIs, broker rules/execution, two-sleeve performance and reconciled income |
| 5 · Personal/hardening | Separate local personal interview/journal, privacy boundary, desktop package | Cloud Life Coach, chosen-channel check-ins, earned autonomy, full legal/security audit and second-user trial |
| 6 · Proof | Evidence export with real local records, source labels, audit integrity and self-reported time | Independently verified settlements, all real operating costs and sustained income over a defined period |

## Next implementation slice

Begin with one dropshipping proof workflow in an owner-selected existing or newly approved store. Define the exact platforms and supplier before adding adapters. A good first slice is read-only order/payment ingestion and reconciliation, followed by a fully reviewed product listing in a test store. Confirm API scopes and operational policies before enabling paid fulfillment. All execution endpoints need external idempotency keys and persisted receipts.

No business model, store, product, niche or account is silently selected. No real external account connection, public post, purchase, investment or payment occurred during this build. The owner’s role remains review and ideas once operational adapters exist; the missing adapters are engineering work, not a request for the owner to perform fulfillment or publishing manually.

## Improvements to the master prompt

The refined design adds recoverable paid-call accounting, immutable approval versions, request retry IDs, normalized finance deduplication, currency integrity, and explicit limits on what an approval proves. It separates evidence of a recorded amount from evidence of a settled payment, and separates a configured API key from a tested request. It also avoids assuming that provider subscriptions include API access.

The vision’s income goal remains the acceptance criterion for future phases. It is not something software generation can promise. Tax, legal and investment planning require qualified review and jurisdiction-specific evidence; a local Guardian check is not certification.

## Deliverables map

| Requested deliverable | Location |
| --- | --- |
| Architecture and security model | `docs/architecture.md` |
| Interview and owner schema | `docs/onboarding.md`, `server/validation.mjs`, `src/Onboarding.tsx` |
| All agent definitions and playbooks | `config/agents.json`, `config/playbooks.json` |
| Working foundation and finance code | `server/`, `src/`, `electron/`, `tests/` |
| Dashboard and installer | `dist/`, `release/The Hub Setup 0.1.2.exe` |
| Token cost assumptions | `docs/cost-model.md` |
| Install/operate/pause/uninstall | `docs/runbook.md` |
| Original and improved prompt | Original retained locally and excluded from published source; refined design in `docs/superpowers/specs/2026-10-17-hub-design.md` |

Optional automatic updates are intentionally absent. The app preserves owner data across clean reinstall.
