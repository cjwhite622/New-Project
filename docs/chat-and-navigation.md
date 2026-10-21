# Chat and navigation update

## Intended outcome

The owner can work through an idea with a business agent in a continuing conversation, retain sent history after restarting, and move an exact completed reply into the existing approval queue. On shorter Windows displays, navigation scrolls while Pause/Resume and owner settings remain reachable. This extends the current application and its provider/account boundaries.

## Decisions and limits

- Reuse the current React/SQLite/serialized-job architecture. Add no runtime dependencies, hosted chat service or subscription.
- Use a dedicated Chat page, saved conversation list/search, per-conversation agent, keyboard composer, visible pending/failure/cost state and copy/review actions.
- Persist conversations in business documents and read assistant results from durable jobs. Only recent complete turns enter follow-up context. The full sent transcript remains local; unsent drafts remain in memory.
- Bind delivery retries to immutable message content and keep unknown provider billing held. A successful send followed by a failed refresh must not become a new send.
- Keep Life Coach notes and vault credentials out of business chat. Render reply text without executing HTML. Chat text cannot execute external actions.
- Keep the existing budget escalation, pause, account permissions and exact Shopify action approvals. Generic reply review copies text without publishing or sending it.
- Scroll the global sidebar's navigation area independently of persistent controls. Keep desktop/tablet navigation visible until the existing 760px mobile breakpoint.

## Plugin use

- **Superpowers:** test-first implementation, reproduced regressions, independent code review and release evidence.
- **Consultor and Business Systems Advisor:** keep the conversation focused on decisions, assumptions, evidence and useful next actions within confirmed owner constraints. No market facts or revenue projections were invented.
- **Codex Coordinator:** inspect coordination enablement and retain one primary task with a bounded parent-owned reviewer. The repository has no enabled coordination board; no background coordinator or extra durable chats were created.
- **AI Psychiatry:** use a finite completion definition and evidence checks, resolve instruction priority, fix observed defects and stop after the required checks pass.
- **There's An AI For That:** query the catalog for local conversational tooling. Returned meeting/practice products did not meet this desktop integration need; none was adopted.
- **STORM Brains4Ai:** perform read-only knowledge searches for conversation/workflow guidance. No matching entries were returned; no execution or checkout was requested.
- **Network Solutions:** review the toolkit's scope. Its marketing-site/domain/hosting workflow does not implement this Electron feature. The owner's chosen hosting remains Hostinger; no unrelated site, domain or hosting purchase was created.
- **GitHub:** maintain the existing review branch and Windows build/download workflow. The original master prompt and local credentials remain excluded from public source.

These are development aids and research checks. Installing a plugin in this chat does not install an authenticated tool into the standalone desktop app.

## Completion evidence

The release must pass domain/API tests, production compilation, all existing browser workflows, the new chat/scrolling browser workflow and native Windows package/GUI/installer checks. Tests use disposable profiles and controlled provider responses. Verification links and actual outcomes belong in `docs/verification.md`; live provider/account behavior and sustained business income are not established by fixtures.
