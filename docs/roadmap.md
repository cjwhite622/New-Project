# Requirements and next gates

The attached vision is broader than a first release. The implementation follows its order by building the local foundation and recorded money visibility first. Live integrations and income proof cannot be accepted without actual accounts, authorization, transactions and source evidence.

| Phase | Implemented in this release | Gate still outstanding |
| --- | --- | --- |
| 0 · Foundation | Interview, owner profile, SQLite, jobs, event log, three provider adapters, owner-confirmed live Kimi task, local routing, caching, budget reservations, three-stage draft batches, persistent business chat, dashboard, scrollable navigation, pause/recovery | General scheduler, webhook ingestion, rate-limit queue and optional Ollama |
| 1 · Money visibility | Manual entry/import, integer cents, P&L, cost estimates, provisional reserve, review time, evidence export | Reconciliation against real payment/bank statements; actual owner income/cost entries |
| 2 · First revenue loop | Six playbooks, explicit launch direction, dependent offer/asset/copy drafts, versioned review, Guardian inspection and an exact-approved unpublished Shopify page adapter | Tested adapters for the owner-selected offer: validated demand → approved live offer → paid order → delivery → support |
| 3 · Attention | Private content draft workspace and review | Official publishing, social research data, media rendering pipeline, schedules, engagement and traffic attribution |
| 4 · Monetization/portfolio | Role definitions, zero default high-risk allocation, explicit opt-in planning cap | Monetization APIs, broker rules/execution, two-sleeve performance and reconciled income |
| 5 · Personal/hardening | Separate local personal interview/journal, privacy boundary, desktop package | Cloud Life Coach, chosen-channel check-ins, earned autonomy, full legal/security audit and second-user trial |
| 6 · Proof | Evidence export with real local records, source labels, audit integrity and self-reported time | Independently verified settlements, all real operating costs and sustained income over a defined period |

## Next implementation slice

The owner selected Gmail, Hostinger, Shopify and Stripe. Version 0.1.4 starts with Shopify: connection inspection, private page preview, exact approval and one unpublished page with a durable receipt. Validate this adapter in a development/test store before a real merchant action. The next slices are reviewed public publishing and customer capture, digital delivery, Gmail workflows and payment reconciliation, using those selected services. Hostinger hosting/domain work and any Stripe-to-Shopify relationship require the actual account configuration and operational policies. Each external change needs an immutable reviewed payload and persisted receipt; uncertain outcomes must remain held rather than being retried automatically.

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
| Working foundation, finance and launch drafts | `server/`, `src/`, `electron/`, `tests/` |
| Dashboard and installer | `dist/`, `release/The Hub Setup 0.1.5.exe` |
| Token cost assumptions | `docs/cost-model.md` |
| Install/operate/pause/uninstall | `docs/runbook.md` |
| Original and improved prompt | Original retained locally and excluded from published source; refined design in `docs/superpowers/specs/2026-10-17-hub-design.md` |

Optional automatic updates are intentionally absent. The app preserves owner data across clean reinstall.
