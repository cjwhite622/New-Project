# Verification record

Verification updated: October 18, 2026 (UTC). Desktop diagnostic release: 0.1.1.

## Verified

- TypeScript checking and Vite production compilation pass.
- All 32 domain/API/startup tests pass and cover interview activation/persistence, exact-cent P&L, invalid dates/amounts, atomic CSV imports, duplicate/conflicting references, normalized money hashes, private-data exclusion, local task events, cached cloud responses, provider usage, budget reservations, concurrent work, 80/100% ceilings, pause/abort, queue resume, crash recovery, approval version/edit/replay, currency and commitment guards, incomplete output, audit tamper detection and business backup recovery. Startup regressions cover missing GUI console handles, server import without stderr, safe diagnostic fallback/privacy, and workspace closure when startup or draining fails.
- Controlled provider-response tests exercise request/usage behavior without spending or provisioned keys. They are not live authentication tests.
- Chromium end-to-end completes the eleven-step interview, creates a local brief, records income, imports an expense, saves/reloads private notes, pauses/resumes, edits owner settings, blocks unconfigured cloud work, edits/approves a draft, checks business-state privacy, and checks the mobile layout. Lost POST responses are simulated to verify that retries preserve one ledger entry and one task.
- Automated WCAG A/AA scans of first-run onboarding and the overview report no violations in the tested state.
- Production npm dependency audit reported zero known vulnerabilities at the time of the check. This does not replace an application security audit.
- An independent code review identified recovery, request-retry, CSV normalization, reservation/currency and incomplete-output issues. Regression fixes were applied and verified.
- The source and packaged Linux Electron GUI both open the owner interview, persist its first answer through the loopback API, keep Node out of the renderer, and write startup stages without the session URL/token. These checks use disposable workspaces.
- The Windows diagnostic batch launcher was run under Wine with a zero-exit executable fixture. It prints the report, includes startup stages and reaches its pause after exit code zero. Portable ZIP CRCs pass, its executable/ASAR match the packaged Windows files, and the source ZIP matches every included workspace file.

## Build and compatibility limits

The native NSIS Windows installer is built from the packaged x64 Electron application. Installer compilation is distinct from native Windows execution. A native Windows install/launch/reinstall/uninstall test remains required. The first display-less Linux Electron attempt exited with SIGSEGV. Subsequent tests using a virtual display successfully opened both the source and packaged Electron GUI. These Linux results do not establish Windows compatibility.

A Windows 10/11 user reported that both the installer and the original portable application do nothing when opened. The original installer passes a 7-Zip NSIS payload integrity check. The exact failure on that computer has not yet been identified.

On October 21 the user clarified that clicking the download link in the Windows Codex desktop app does nothing. The confirmed blocker is delivery of the cloud workspace file to the user's PC. The earlier reports do not establish that the executable actually ran on that computer. The Windows build workflow creates browser-downloadable GitHub artifacts and tests the source and packaged GUI on a disposable hosted Windows runner. Its native results must be checked before treating the new workflow as verified.

The packaged Windows x64 runtime and an in-memory SQLite query execute under an isolated Wine 10 toolchain. Loading the local server originally failed with `EBADF`: `debug`, loaded by Express/body-parser, reads Node's lazy `process.stderr` stream during import, and the GUI process inherited an invalid console handle. Release 0.1.1 preserves valid stdout/stderr streams and supplies a non-TTY sink only when creating a stream throws `EBADF`. After the change the same Windows runtime imports the server and the full packaged application reaches workspace creation, loopback-server startup and native-window creation. Full GUI verification under Wine remains incomplete; the test stalls during native-window creation and Wine reports an unimplemented DirectComposition graphics API. Native Windows behavior remains unverified. No sandbox or graphics restrictions were removed from the shipped app.

The portable launcher in 0.1.1 stays open and shows its report after every exit, including zero. The application records runtime versions, startup stages and safe error codes, omitting messages, stacks, URLs, keys and record contents. A startup failure after the workspace opens now closes it even if no server began listening. A Windows launch report is still needed to establish whether these fixes address the user's symptom.

No real provider account, ecommerce account, bank, supplier, broker or social account was authorized or accessed. No customer order, external post, purchase or money movement occurred. No verified income or profitable operating record was generated.

## Reproduce

```sh
npm test
npm run build
npm run test:browser
npm audit --omit=dev --audit-level=high
npm run package:win
```

Browser screenshots use disposable test input and finance records. They are evidence of application behavior, not evidence of income. The installed app starts with an empty workspace and the owner interview.
