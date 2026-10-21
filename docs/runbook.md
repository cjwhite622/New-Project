# Install and operate The Hub

## Windows installation

Use a 64-bit Windows 10/11 computer. Close any older copy and run `The Hub Setup 0.1.5.exe`. The installer places the application in your user’s local Programs folder and adds Start menu shortcuts. It needs no administrator account. Existing owner data and saved provider settings are preserved. Open The Hub and finish the Manager conversation if this is a new workspace. Confirm the owner profile before agents activate.

The installer is unsigned. The Windows workflow compiles it with native NSIS and runs desktop and installation checks on a disposable Windows Server 2025 runner. Source and packaged GUI launches have passed there. Check the [verification record](verification.md) for the installation results and tested commit. The owner confirmed version 0.1.1 launches and completes the interview on their Windows PC. The owner also reported a completed live Manager task after correcting both Kimi model settings to K2.6. The automated model-discovery and recovery tests use controlled responses; provider invoices remain the authority for charges.

For a silent launch, use the portable ZIP and open **Start The Hub.cmd** from its extracted folder in Windows File Explorer. When the process exits, the console stays open and Notepad displays `%TEMP%\The Hub\diagnostics\windows-launch.txt`. If the process stays open without a window, read `%APPDATA%\The Hub\diagnostics\desktop-startup.log` instead. Startup logging falls back to `%TEMP%\The Hub\diagnostics\desktop-startup.log` if its normal folder cannot be written. It records startup stages, runtime versions and error codes, excluding credentials, record contents, error messages and stacks. Do not delete the workspace to troubleshoot launch failures.

## First useful session

1. Complete the interview. Choose the business model yourself and confirm the proposed limits.
2. Run **Create my first brief**. This is local, deterministic, and costs no API tokens.
3. Open Finance. Record existing costs and income or import a CSV. These records remain unverified.
4. Write the Brand Bible with mission, voice and prohibited claims.
5. Connect a developer API key under Settings → Model providers when ready. Verify your model access and token prices. Saved keys are not marked tested until a model request succeeds.
6. Open Launch. Enter the audience and desired outcome, explicitly choose the offer format and content preference, then **Save direction**. This is local and free.
7. Click **Prepare launch drafts** for up to three budgeted AI requests. Research, the Content Strategist and the Manager prepare the offer brief, starter asset, and landing-page copy with three welcome emails. Cloud calls require a USD profile in this release.
8. Read **View draft** for each stage, then **Send pack to Approvals**. Inspect/edit the exact pack in the existing queue and decide. Approval records review; it does not publish a page, send email or accept payment.
9. For other work, ask the Manager to explore an idea or the Content Strategist to draft a post. Results remain in Task history and can also enter the same approval queue.

## Chat with your team

Version 0.1.5 adds **Chat** in the sidebar. **Ask your team** in the header or **Ctrl+K** (Cmd+K on Mac) opens it. Use your existing configured model provider; no new hosting or chat subscription is required.

Choose a business agent for a new conversation, enter a message, then send. **Enter** sends; **Shift+Enter** adds a line. A conversation keeps its selected agent. Use **New conversation** to change agents; the earlier history stays saved and searchable. Drafts you have not sent remain in memory while switching conversations on the Chat page; leaving the page or restarting discards unsent drafts.

Each message creates one durable, budgeted job. A completed reply shows its estimated cost and any cache hit. Reading saved messages costs no model tokens. The full sent history is saved locally, while only recent completed turns (up to 12 pairs / 12,000 serialized characters) are included in a follow-up request. Earlier messages and failed replies are not silently treated as current model memory. Your business chat never reads the separate Life Coach notes or credentials. It is part of the business backup and can contain business information; messages are sent to your connected model API for replies.

If delivery loses its HTTP response, **Check message delivery** checks the same immutable operation. It does not create another paid job. Queued/running replies show their state. Unknown provider outcomes keep their cost reservation and block further messages in that conversation until billing is checked and reconciled in Finance. No provider call is automatically retried. A blocked task explains missing providers, disabled agents, pause or budgets; correct the issue, then explicitly send a message.

**Send reply to Approvals** copies the exact completed answer into one review card. The card is idempotent and can be reopened. Approval records review; text in chat cannot publish, email, charge a customer or invoke the Shopify adapter. Those actions keep their separate exact approvals. Reply text is rendered as text, without executing returned HTML.

The left sidebar now has its own keyboard-focusable scroll area. Navigation, system health and the workspace name can scroll while Pause/Resume and owner controls remain visible. On phones, open the navigation drawer to use the same scroll behavior.

## Launch draft recovery

If the draft request loses its response, **Retry draft request** checks the same operation; it does not create a second batch. There is no automatic retry of a paid model request. **View issue** explains blocked or failed stages. If billing is uncertain, check the provider's dashboard and reconcile it in Finance before requesting another pack. If an agent is disabled, re-enable it in Settings before preparing fresh drafts. All three jobs are created together or none are created.

Changing the saved direction or owner profile marks the old pack outdated. Queued stages stop before dispatch, and a completed outdated pack cannot be submitted as a new review. A request already received by the provider may still be charged. **Prepare fresh drafts** is a new explicit, budgeted request after prior work has finished and uncertain billing has been reconciled. Prior jobs and approvals remain in their history.

The Manager receives your confirmed business time and budget limits. Personal journal data and provider keys are excluded. Review time suggestions are model guidance; record actual time in Finance. Draft prices, demand estimates and service recommendations still need evidence before public use. Public publishing, email, booking, payment and delivery connections remain outstanding engineering work.

## Shopify draft-page connection and action

Version 0.1.4 adds the first business adapter. Your approved launch pack is source material; its approval does not itself authorize a store change.

1. Open **Settings → Business connections**. Enter the permanent `your-store.myshopify.com` domain, without a URL or path.
2. In Shopify’s Dev Dashboard, configure and install an app on your own store with `write_online_store_pages` or `write_content`. Apps/stores in the same organization can use the app client ID and secret. The Hub renews expiring tokens through the official client-credentials grant. Alternatively enter a working Admin API access token. This adapter needs no customer, order or payment access. Enter credentials only in The Hub. They are OS-encrypted in the installed app when available, session-only otherwise, and excluded from prompts and business backups.
3. **Save Shopify connection**, then **Check Shopify connection**. This reads store identity and granted scopes only. Changing or disconnecting settings invalidates the check and unexecuted action review.
4. In Launch, **Prepare Shopify page preview** uses one budgeted Content Strategist request, or its exact cache match. It extracts public copy from the currently approved pack. Review and edit the title/body locally, then save changes. Internal strategy, the starter asset itself and welcome emails are excluded by the extraction prompt; inspect the resulting copy before approving an external action.
5. **Review Shopify draft action** shows the exact store, title, unique handle and body in Approvals. Approving queues a deterministic Publishing job with `isPublished: false`. Only this managed action can call the page adapter. The adapter rechecks source, approval version, store identity, credentials, agent availability and pause at dispatch. Changing copy or credentials requires a fresh review. A returned page ID appears in Launch and Approvals.

The page remains unpublished. Customer capture, forms, products, checkout, digital delivery and email are not activated. Gmail, Hostinger and Stripe remain the intended other services; their operational adapters are not in this slice. Shopify payment-provider availability depends on the merchant’s country and Shopify Payments eligibility; do not assume a separate Stripe account can be selected inside Shopify checkout.

If the preview POST loses its response, **Retry page preview request** checks the same local operation without another job. A store write is never automatically retried. If its response is lost or the app closes during dispatch, the action stays **unknown**. Launch exposes every held action, including older proposals. **Check Shopify result** performs a read-only exact-handle lookup in the original store; zero matches keep the hold. If Shopify separately confirms no page was created, record that conclusion and a note. This is owner-reported evidence and permits a new review, not an automatic write. Veto cannot undo or hide a dispatched attempt.

A returned page whose copy or visibility differs from the review stays held for inspection. A read-only check uses its saved page ID. You may record your own inspection and acceptance of that known page with a note; this is explicitly owner-reported, keeps the receipt, and cannot repeat the same action. It does not change or publish the page. Pre-dispatch failures become blocked and can receive a fresh exact review after the underlying issue is corrected. Pause can interrupt transport but cannot reverse a change Shopify already received.

## Kimi model-not-found recovery

Kimi K2.5 was [discontinued on August 31, 2026](https://platform.kimi.ai/docs/models). Version 0.1.1 used that retired model by default; Moonshot returns 404 when the model is missing or the account lacks access. Version 0.1.2 defaults new workspaces to `kimi-k2.6`, with configured input/output rates of $0.95/$4 per million tokens for both tiers. Existing saved settings are preserved.

In Settings → Model providers → Kimi / Moonshot:

1. **Check available models** retrieves model names using the saved key without generating text. Save a replacement key before checking it. Select routine and premium models from the returned list; the Manager uses the premium setting.
2. For saved K2.5 settings, **Use Kimi K2.6** selects that model and its default rates for both tiers. Review the values and click **Save provider** to apply them.
3. On version 0.1.1, use **Models & token rates** to enter those values manually. This fixes the configuration without reinstalling.
4. Create a new task. Only a completed generation request changes the provider badge to **Tested by request**. A successful model-list lookup alone does not prove generation access.

For new requests, a structured authentication, permission or model-not-found rejection releases its reservation and reports the cause. Timeouts, interrupted requests, unstructured gateway errors and server failures retain their reservations for billing review. Arbitrary provider error messages are never copied into the app's logs or UI. No request is automatically retried.

An earlier reservation created by 0.1.1 is preserved. Check the provider dashboard and reconcile it in Finance; enter zero only if the provider confirms no charge. The update does not rewrite historical billing outcomes.

## Money records

The ledger uses integer cents in the owner’s selected currency. Imported CSV columns are:

```csv
date,kind,amount,category,description,reference
2026-10-17,income,25.00,sales,Digital guide sale,order-001
2026-10-17,expense,2.50,fees,Payment processing,fee-001
```

Use ISO dates, income/expense, positive amounts with at most two decimals, and a stable reference when possible. Imports validate every row before committing any. Duplicate references skip identical records and reject conflicts. Reference-free rows use normalized content hashes. Two genuinely distinct sales with identical details need distinct references; otherwise they deduplicate.

Manual records and imports do not prove settlement. Tax reserve uses your editable planning percentage on positive recorded profit. Confirm with a licensed professional. No tax payment or investment transfer is executed.

## Budget and request recovery

Every paid request reserves a conservative maximum before dispatch. API costs count toward operating costs and the hard ceiling. Pending/unknown reservations count against all relevant limits. You cannot lower a budget below committed costs or change currency after any financial/usage record exists.

If a task fails after a request may have reached the provider, Finance shows **A provider request needs a billing check**. Inspect the provider dashboard, then record the charge and token counts in the app. Enter zero only when you have confirmed no charge. This creates an owner-reported reconciliation and releases the reservation. It never repeats the task. Provider invoices remain the authority for actual billing.

Model output cut off by a token limit fails visibly. Known usage is still recorded. The partial text never becomes completed cached work.

## Pause and resume

**Pause all agents** persists the pause and interrupts the active model or Shopify request. It cannot reverse a request already received by a provider. You can inspect records and settings while paused. **Resume team** starts queued jobs again. Interrupted paid jobs become failed on restart and need billing reconciliation; they do not replay automatically.

Closing the app stops work. It does not create a new user pause preference. If you explicitly paused, the next launch remains paused.

## Data, backup and reinstall

Desktop data lives in `%APPDATA%\The Hub\workspace` on Windows, outside `%LOCALAPPDATA%\Programs\The Hub`. It includes:

- `business.sqlite` plus SQLite WAL files while running.
- `personal.sqlite` plus its WAL files.
- `credentials.encrypted.json` when OS encryption is available.

Settings → Data & backup downloads a consistent SQLite business backup as JSON. It excludes keys and private personal notes. Export personal notes separately if you want a private copy. Evidence reports contain business transactions, audit hashes and self-reported owner time.

Uninstalling removes only shipped application files and shortcuts. It preserves the workspace. Reinstalling uses that same workspace without repeating setup. To remove all data permanently, close the app first and explicitly delete the workspace folder using your OS file manager. Do this only if you intend to erase the data.

Disaster restoration is an administrator procedure in this release: close the app, preserve the current workspace, decode the exported JSON’s `business` base64 field into `business.sqlite`, and remove stale business WAL/SHM files before reopening. Private notes and keys are separate. Never overwrite an open database. A future version should add guided in-app restoration. The automated backup test restores a backup into a fresh SQLite file and reads the owner profile.

## Development and support

Use Node 24. `npm run dev` runs the loopback service on 4318 and Vite on 5173. Development data defaults to `.hub-data/`, ignored by git. `HUB_DATA_DIR` selects a different local server data directory. `PORT` selects its port. The browser test uses disposable data and never touches a real owner workspace.

`npm run package:win` builds the UI, prepares the x64 Electron application and runs a native NSIS compiler. The installer script uses an exact shipped-file uninstall manifest and never recursively deletes the owner’s data folder. Build caches may need a writable `XDG_CACHE_HOME`, `ELECTRON_BUILDER_CACHE`, and npm cache in restricted environments. Preserve any configured proxy/CA settings. The delivered application does not require Node, npm, NSIS, Python or Wine on the owner’s Windows computer.
