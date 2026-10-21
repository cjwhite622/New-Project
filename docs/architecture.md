# Architecture

The renderer displays a local React/TypeScript dashboard. It has no direct filesystem or Node access. An Express loopback service owns the data and every state change. Electron starts that service with a random session capability and opens the compiled UI. The same service supports local browser development.

```mermaid
flowchart LR
    Owner[Owner interview and decisions] --> UI[Local dashboard]
    UI --> API[Authenticated loopback API]
    API --> Policy[Budgets, approvals, pause state]
    Policy --> Worker[Serialized durable job worker]
    Worker --> Local[Deterministic local tasks]
    Worker --> Registry[Provider registry]
    Registry --> Cloud[OpenAI / Anthropic / Moonshot]
    Worker --> DB[(Business SQLite)]
    DB --> Events[Structured event log]
    API --> Personal[Owner-only personal service]
    Personal --> Private[(Separate personal SQLite)]
```

## Modules

| Module | Responsibility |
| --- | --- |
| `server/storage.mjs` | SQLite setup, transactions, audit hashes, events |
| `server/validation.mjs` | Owner, money and record boundary validation |
| `server/hub.mjs` | Owner profile, agent configuration, settings, personal service, reports |
| `server/finance.mjs` | Integer-cent ledger, CSV parsing, P&L and tax estimate |
| `server/orchestrator.mjs` | Queue, routing, budget reservation, pause, recovery and approval versions |
| `server/providers.mjs` | Provider request/response contracts, token pricing, session key vault |
| `server/app.mjs` | Authenticated HTTP interface, origin/host checks and exports |
| `electron/main.cjs` | Desktop lifecycle, OS-encrypted key storage and isolated renderer |
| `config/agents.json` | Sixteen roles, permissions, triggers, escalation, ceilings and KPIs |
| `config/playbooks.json` | Six business models and adapted duties |

## Task lifecycle

The owner confirms the interview before tasks or provider connections are accepted. A unique request ID creates a queued job and event. The worker runs jobs one at a time, so budget checks and reservations cannot race. A deterministic task returns local calculations with zero model tokens. A cloud task chooses the least expensive enabled, connected provider for the requested tier.

The cloud path uses the agent mission, selected business fields, Brand Bible and task. It has no tool calls, credentials in prompts, personal journal access, or execution permissions. An exact cache match returns without a paid call. Otherwise, the worker reserves a conservative input-byte/output-token cost estimate and agent token allowance inside a database transaction. It checks the monthly API, operating and hard limits before dispatch.

Known usage settles the reservation and records an API expense estimate. Anthropic cached input tokens count toward usage; pricing conservatively includes cache-write overhead. Incomplete/truncated responses settle known usage, fail visibly and never enter the completed cache. Network failures, missing usage and interruption retain the maximum reservation as unknown. The owner records the provider billing outcome in Finance to release it. The app does not retry paid requests automatically.

At 80% of a token limit, a premium task downgrades to routine and informs the Manager through an event. At 100%, cloud work blocks and creates a budget review card. This release has no deterministic substitute for arbitrary writing. Local tasks remain available.

Ten completed jobs of an agent/type create a distillation-candidate event. This count is not a public-action success score. Earned autonomy requires later execution adapters and an audited success track record.

## Approvals and recovery

An approval includes who, what, why, cost, risk, expected outcome, recommendation and exact content. Its version must match the decision. Editing increments the version, returns the card to pending and invalidates earlier authorization. Guardian may veto. Budget approval never raises a limit by itself, and a publishing approval never claims content was posted.

Pause persists and aborts the active provider request. Resume drains queued work. Restart marks interrupted jobs failed and exposes their retained reservations for reconciliation. Queued jobs can resume; paid jobs with unknown outcomes never replay automatically. Settings and local records remain accessible while paused.

## Data and privacy

`business.sqlite` stores profile, settings, agent overrides, jobs, approvals, events, usage, cache, time records, finance and audit. `personal.sqlite` stores only private interview answers and notes. The business state endpoint, business prompts, audit, evidence export and business backup exclude personal content. Personal exports require an explicit owner action.

This is a single-owner application. Privacy enforcement applies to the app's agent and API boundaries. Databases are not encrypted at rest; the OS account and disk encryption protect local files. A machine administrator can inspect or rewrite local data. The audit hash chain detects changed entries but is not an external proof of immutability or income.

Desktop keys use Electron `safeStorage`. On Linux, an insecure `basic_text` backend triggers session-only storage. Browser development always uses session-only provider secrets. The renderer stores only its random app-session capability, never API keys. Backups exclude provider keys. No configured credential was read or reused during this build.

The server binds to 127.0.0.1, rejects non-loopback Host headers and foreign Origins, and requires a session bearer capability. Desktop bootstrap is disabled. Development bootstrap requires a custom header and relies on same-origin browser access checks. CSP blocks remote scripts, fonts, frames and connections from the renderer. Fonts are bundled. Electron denies permission requests, new windows and remote navigation.

## Explicit extension points

Agent definitions and playbooks are JSON. Adding a provider requires one adapter in the provider module, its editable model/rate definition and contract tests. Business tools should be separate adapters with explicit per-agent permissions, immutable approval payloads, external idempotency keys and verified execution receipts. The first live adapter is the next milestone; installing a chat plugin does not authorize or create an integration inside the standalone app.
