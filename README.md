# The Hub

A local-first desktop workspace for a business and its AI team. This first release implements the foundation and money-tracking workflows from the attached vision. It starts with a resumable interview and keeps the human in control of decisions, budgets and private information.

## Get started

Downloadable Windows builds are available from the [Windows build workflow](https://github.com/cjwhite622/New-Project/actions/workflows/windows-build.yml). Sign into GitHub, open a successful run, and download **The-Hub-Windows-x64** under Artifacts. Choose **Extract All**, open the **The Hub** folder, and run **The Hub.exe**. This browser download transfers the application to your PC; cloud workspace paths in chat may only open a file viewer. GitHub keeps these build downloads for 90 days.

For installation, download **The-Hub-Installer** from the same successful workflow run, choose **Extract All**, and open **The Hub Setup 0.1.1.exe**. Open The Hub, complete the interview and confirm your plan. No terminal or configuration file is needed in the installed application. The installer is unsigned; native Windows 10/11 hardware confirmation is still outstanding.

If setup does not open, use the portable download described above. Keep the entire extracted folder together. **Start The Hub.cmd** records Windows/CPU information, the exit code and safe startup stages. It always displays its report after the app exits. This diagnostic release preserves owner data. A download link that does nothing has not transferred the app to your PC; open the HTTPS GitHub download in Edge or Chrome and sign in if asked.

For development, install Node.js 24 and run:

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. Or run `npm run build` followed by `npm run server` and open `http://127.0.0.1:4318`. The command-line server starts a development session by default. The Electron application always uses an authenticated production session on an ephemeral loopback port.

## What works

- Resumable interview, owner confirmation, six business playbooks and sixteen agent definitions.
- Persistent jobs and structured events, local daily brief, budget review, provisional tax estimate and Guardian system inspection.
- Private cloud-assisted drafts and ideas through OpenAI, Anthropic or Kimi/Moonshot developer APIs. Keys, enabled models and token rates are editable in the app. Choose an account with appropriate model access. Consumer chat subscriptions do not include API billing.
- Local exact-match caching, Anthropic prompt-cache hints, bounded output, usage-based cost estimates, budget reservations, tier downgrade and per-agent token limits. Unknown paid-call outcomes require a billing check and explicit reconciliation.
- Versioned approval cards with approve, deny and edit. Decisions never pretend to execute unavailable integrations.
- Monthly P&L, transaction entry, atomic CSV preview/import, duplicate protection, source attribution, provisional tax reserve, API costs and owner review-time records.
- Private Life Coach interview/journal in a separate database, editable Brand Bible, provider readiness checks, hash-chained business audit and exports.
- Kill switch, interrupted-job recovery and queued-work resume. Provider requests are never automatically retried.
- Windows installer, uninstall manifest that deletes only shipped files, and application data outside the installation directory.

## What still needs real-world work

The app does not currently operate a store, place supplier orders, publish social posts, generate finished videos, transfer money or execute investments. These require tested official API adapters and owner account authorization. Social analytics, automatic daily scheduling/batching, external webhooks, autonomous workflows, automatic Life Coach check-ins, local Ollama inference and earned public-action autonomy are later gates.

No provider key was provisioned or live model call charged during this build. Provider contracts are tested with controlled responses. Financial records begin empty. Manual and CSV income remain unverified; provider costs use configurable rates and conservative rounding. No real-income or consistent-profit claim has been established.

The app supports USD, GBP, EUR, CAD and AUD ledgers. Budget limits apply to configured usage estimates. Use provider account-level limits for invoice enforcement. Cloud requests currently require a USD owner profile because provider rates are USD and no exchange-rate policy is configured. Currency locks once finance or usage records exist.

## Validate and package

```sh
npm test
npm run build
npm run test:browser
npm run desktop
npm run package:win
npm run package:portable
```

The browser test uses `/usr/bin/chromium`, or `HUB_CHROMIUM_PATH`. Windows packaging uses Electron Builder to prepare the application and a native NSIS compiler to create the installer; it does not require Wine. The lockfile pins the build tooling. The current package targets x64 Windows 10/11. Signing and confirmation on physical Windows 10/11 hardware remain release gates. Native GUI checks already pass on a hosted Windows Server 2025 runner.

`npm run test:desktop` additionally checks an actual Electron GUI on Linux with an available display. Set `HUB_DESKTOP_EXECUTABLE=release/linux-unpacked/the-hub` to check the packaged ASAR application. It uses a disposable workspace and does not establish Windows compatibility.

The Windows workflow runs source and packaged desktop checks, then `npm run test:installer:windows` to install, open, reinstall and uninstall the application while checking that both saved workspace databases survive unchanged. These tests require a disposable GitHub-hosted Windows runner and refuse to reuse an existing Hub profile or installation. All desktop checks use the shipped application's sandbox and graphics settings.

See [architecture](docs/architecture.md), [runbook](docs/runbook.md), [cost model](docs/cost-model.md), [interview and schema](docs/onboarding.md), [requirements and roadmap](docs/roadmap.md), and [verification record](docs/verification.md). The original attachment is retained in the local workspace and excluded from published source. Improvements and scope decisions are in [refined design](docs/superpowers/specs/2026-10-17-hub-design.md).
