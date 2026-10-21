# Verification record

Verification updated: October 21, 2026. Desktop release: 0.1.2.

## Verified

- TypeScript checking and Vite production compilation pass.
- All 39 domain/API/startup/provider tests pass and cover interview activation/persistence, exact-cent P&L, invalid dates/amounts, atomic CSV imports, duplicate/conflicting references, normalized money hashes, private-data exclusion, local task events, cached cloud responses, provider usage, budget reservations, concurrent work, 80/100% ceilings, pause/abort, queue resume, crash recovery, approval version/edit/replay, currency and commitment guards, incomplete output, audit tamper detection and business backup recovery. Startup regressions cover missing GUI console handles, server import without stderr, safe diagnostic fallback/privacy, and workspace closure when startup or draining fails.
- Controlled provider-response tests exercise request/usage behavior without spending or provisioned keys. They are not live authentication tests.
- Chromium end-to-end completes the eleven-step interview, creates a local brief, records income, imports an expense, saves/reloads private notes, pauses/resumes, edits owner settings, blocks unconfigured cloud work, edits/approves a draft, checks business-state privacy, and checks the mobile layout. Lost POST responses are simulated to verify that retries preserve one ledger entry and one task.
- Automated WCAG A/AA scans of first-run onboarding and the overview report no violations in the tested state.
- Production npm dependency audit reported zero known vulnerabilities at the time of the check. This does not replace an application security audit.
- An independent code review identified recovery, request-retry, CSV normalization, reservation/currency and incomplete-output issues. Regression fixes were applied and verified.
- The source and packaged Linux Electron GUI both open the owner interview, persist its first answer through the loopback API, keep Node out of the renderer, and write startup stages without the session URL/token. These checks use disposable workspaces.
- The Windows diagnostic batch launcher was run under Wine with a zero-exit executable fixture. It prints the report, includes startup stages and reaches its pause after exit code zero. Portable ZIP CRCs pass, its executable/ASAR match the packaged Windows files, and the source ZIP matches every included workspace file.
- Seven provider regressions cover the current Kimi model/rates and request format, confirmed model-rejection accounting/privacy, ambiguous HTTP outcomes, authenticated read-only model discovery, missing-key rejection, model-family parameters, and documented authentication/permission rejections. The initial regression run reproduced the retired model default, misleading reservation state, missing discovery endpoint and incompatible model parameters on 0.1.1. All seven checks now pass.
- A focused Chromium workflow reproduces a structured Kimi 404, checks the released reservation, retrieves model names without generation, explicitly changes both models/rates, saves the settings, completes a draft and verifies the provider badge. The tested settings view passes automated WCAG A/AA checks and mobile width checks. These responses are controlled fixtures; no real key or provider charge is used.
- [Native Windows build 39587505160](https://github.com/cjwhite622/New-Project/actions/runs/39587505160) passes all 32 tests, compiles the NSIS installer, and opens the source, packaged and installed desktop GUI on a disposable Windows Server 2025 runner. All three GUI checks save the first interview answer, reload it, verify renderer isolation and inspect the safe startup log. The installer check runs silent installation, same-version reinstall and uninstall; installed executable/ASAR hashes match the packaged application, uninstall removes the application directory, and both workspace SQLite files retain their exact hashes after reinstall and uninstall. Screenshots, safe startup logs and the lifecycle result are uploaded as test evidence. Portable and installer downloads are uploaded successfully. Tested implementation commit: `78cc50cffb23e4e1665763618430602de4307e54`.

## Build and compatibility limits

The native NSIS Windows installer is built from the packaged x64 Electron application after validating its executable and ASAR output. Native Windows source, packaged and installed GUI checks and the silent installer lifecycle pass. The interactive wizard, upgrades between different versions and physical Windows 10/11 hardware checks remain outstanding. The first display-less Linux Electron attempt exited with SIGSEGV. Subsequent virtual-display tests successfully opened both the source and packaged Linux GUI.

A Windows 10/11 user reported that both the installer and the original portable application do nothing when opened. The original installer passes a 7-Zip NSIS payload integrity check. The exact failure on that computer has not yet been identified.

On October 21 the user clarified that clicking the download link in the Windows Codex desktop app does nothing. The confirmed blocker was delivery of the cloud workspace file to the user's PC. The earlier reports do not establish that the executable actually ran on that computer. With the user's explicit approval for public distribution, the Windows build workflow now provides browser-downloadable GitHub artifacts. The first native build caught an NSIS input pattern mixing Windows directory separators with a Unix wildcard separator; the packaging script now passes a host-native pattern. The next native build and both GUI checks passed. The original supplied prompt is excluded from the public source branch and source archive.

The packaged Windows x64 runtime and an in-memory SQLite query execute under an isolated Wine 10 toolchain. Loading the local server originally failed with `EBADF`: `debug`, loaded by Express/body-parser, reads Node's lazy `process.stderr` stream during import, and the GUI process inherited an invalid console handle. Release 0.1.1 preserves valid stdout/stderr streams and supplies a non-TTY sink only when creating a stream throws `EBADF`. After the change the same Windows runtime imports the server and the full packaged application reaches workspace creation, loopback-server startup and native-window creation. Wine GUI verification remains incomplete because it reports an unimplemented DirectComposition graphics API during window creation. The subsequent native Windows GUI checks pass with the shipped sandbox and graphics settings.

The portable launcher in 0.1.1 stays open and shows its report after every exit, including zero. The application records runtime versions, startup stages and safe error codes, omitting messages, stacks, URLs, keys and record contents. A startup failure after the workspace opens now closes it even if no server began listening. The owner subsequently confirmed the GitHub download, application launch, interview and first local brief. Their first cloud task failed with a Kimi HTTP 404; version 0.1.2 corrects the retired K2.5 default and adds available-model discovery and structured rejection handling. Live success with the owner's selected account/model remains to be confirmed.

No ecommerce account, bank, supplier, broker or social account was accessed. Automated provider tests use controlled responses; the owner connected their own provider account and reported the Kimi 404 after installation. No provider key was shared with the development environment. No customer order, external post, purchase or money movement occurred. No verified income or profitable operating record was generated.

## Reproduce

```sh
npm test
npm run build
npm run test:browser
npm audit --omit=dev --audit-level=high
npm run package:win
```

The Windows workflow also runs `npm run test:desktop:windows` for source and packaged applications and `npm run test:installer:windows`. These installation checks are restricted to a disposable GitHub-hosted Windows runner and refuse an existing application directory or owner profile. They never run against the owner's real workspace.

Browser screenshots use disposable test input and finance records. They are evidence of application behavior, not evidence of income. The installed app starts with an empty workspace and the owner interview.
