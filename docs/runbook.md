# Install and operate The Hub

## Windows installation

Use a 64-bit Windows 10/11 computer. Run `The Hub Setup 0.1.2.exe`. The installer places the application in your user’s local Programs folder and adds Start menu shortcuts. It needs no administrator account. Open The Hub and finish the Manager conversation. Confirm the owner profile before agents activate.

The installer is unsigned. The Windows workflow compiles it with native NSIS and runs desktop and installation checks on a disposable Windows Server 2025 runner. Source and packaged GUI launches have passed there. Check the [verification record](verification.md) for the installation results and tested commit. The owner confirmed version 0.1.1 launches and completes the interview on their Windows PC. The updated build still needs an owner-side cloud request to verify the configured account and model.

For a silent launch, use the portable ZIP and open **Start The Hub.cmd** from its extracted folder in Windows File Explorer. When the process exits, the console stays open and Notepad displays `%TEMP%\The Hub\diagnostics\windows-launch.txt`. If the process stays open without a window, read `%APPDATA%\The Hub\diagnostics\desktop-startup.log` instead. Startup logging falls back to `%TEMP%\The Hub\diagnostics\desktop-startup.log` if its normal folder cannot be written. It records startup stages, runtime versions and error codes, excluding credentials, record contents, error messages and stacks. Do not delete the workspace to troubleshoot launch failures.

## First useful session

1. Complete the interview. Choose the business model yourself and confirm the proposed limits.
2. Run **Create my first brief**. This is local, deterministic, and costs no API tokens.
3. Open Finance. Record existing costs and income or import a CSV. These records remain unverified.
4. Write the Brand Bible with mission, voice and prohibited claims.
5. Connect a developer API key under Settings → Model providers when ready. Verify your model access and token prices. Saved keys are not marked tested until a model request succeeds.
6. Ask the Manager to explore an idea or ask the Content Strategist to draft a post. Cloud calls require a USD profile in this release.
7. Review the result in Task history. Send a public draft to Approvals, inspect/edit its exact content, then decide. Approval records permission; it does not publish anything.

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

**Pause all agents** persists the pause and interrupts the active model request. It cannot reverse a request already received by a provider. You can inspect records and settings while paused. **Resume team** starts queued jobs again. Interrupted paid jobs become failed on restart and need billing reconciliation; they do not replay automatically.

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
