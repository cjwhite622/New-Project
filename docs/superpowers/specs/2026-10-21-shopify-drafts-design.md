# Shopify draft adapter

## Intent

Continue the approved Hub program using the owner's chosen services: Gmail, Hostinger, Shopify and Stripe. The first executable business adapter turns the approved launch pack into an unpublished Shopify page. The owner supplies ideas and reviews exact changes in the existing queue. Account secrets stay in the desktop vault. No live merchant credentials are available in the development environment.

## First slice

1. Add Shopify connection settings for a permanent `*.myshopify.com` domain. Support a merchant-supplied Admin API token and the official client-credentials grant for apps/stores owned by the same organization. The latter renews expiring tokens before requests. Do not create a store, change domains, install an app or alter payment settings.
2. Check the actual shop identity and page-write scopes with a read-only query. Bind review cards to the verified store and connection version. Configuration changes invalidate prior checks.
3. From a currently approved launch pack, request one budgeted private page proposal from the Content Strategist. Validate structured title/body text, escape HTML and show the resulting page locally. Source review, launch direction and owner-constraint changes invalidate queued proposals and unexecuted actions.
4. Submit the exact title, unique handle, body and target store to one action-specific approval card. Its protected payload cannot be changed through the generic text editor. Approving queues a deterministic Publishing job; the existing serialized worker and pause switch control dispatch.
5. Call only the fixed Admin GraphQL `pageCreate` mutation with `isPublished: false`. Persist dispatch state before transport and a returned page receipt afterward. Never automatically retry an uncertain write. A lost client response reuses the same local operation.
6. Recover an uncertain outcome through read-only exact-handle inspection. A missing search result does not prove non-creation. Known mismatched receipts can be rechecked by saved page ID or explicitly accepted with an owner-reported inspection note; neither path repeats the action. If Shopify separately confirms no page exists, the owner may record that conclusion with a note; it is owner-reported evidence and enables a new reviewed request, never an automatic retry.

## Boundaries

This slice creates unpublished pages only. Publishing, product creation, checkout configuration, customer capture, digital delivery and email sending remain separate actions and adapters. Gmail remains the intended owner-mail service; Hostinger remains the existing hosting/domain service; Stripe remains a separate account whose relationship to Shopify payments must be verified. Do not introduce another hosting or email subscription, change DNS, send messages or charge customers during development.

The first page is a preview of public copy, not the paid asset, internal strategy or welcome-email sequence. The model has no Shopify credentials or tools. Local validation and exact action review precede all store writes. No raw HTML from model output is executed.

## Implementation and acceptance

- Isolate official HTTP/auth contracts in `server/shopify-api.mjs` and state/review/recovery in `server/shopify.mjs`.
- Reuse document storage, OS-encrypted/session-only vault, provider usage accounting, durable jobs, approval versions, origin/session checks and audit records. Add no SQL schema migration or product dependency.
- Add a Business connections tab and the page proposal/preview beneath Launch. Existing generic approvals retain their behavior. Managed action receipts remain visible after pause or veto; revocation cannot undo an already dispatched request.
- Prove fixed endpoint/domain validation, secret exclusion, token renewal, approval/payload binding, no write before approval, forced unpublished state, replay protection, stale-source/store blocking, disabled-agent/pause behavior, unknown outcomes, restart recovery and explicit reconciliation with controlled responses.
- Run all domain tests, production build, baseline/provider/launch browser workflows, a focused Shopify browser workflow, and native Windows package/GUI/installer checks. Use disposable fixtures only. Release as 0.1.4 after checks pass; no new installer is needed for documentation-only updates.

## Primary references

- [Shopify client credentials](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant)
- [Admin GraphQL page creation, 2026-10](https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/pageCreate)
- [PageCreateInput and its default publication behavior](https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/PageCreateInput)
- [Shopify payment-provider availability](https://help.shopify.com/en/manual/payments/third-party-providers/payment-gateway-availability)
- [Hostinger API overview](https://docs.hostinger.com/api-reference/overview)
