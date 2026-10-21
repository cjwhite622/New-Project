# Token cost model

All figures below are planning assumptions in USD, not provider quotes, measured savings, or guaranteed costs. Check current provider pricing and update Settings before a paid run. Chat subscriptions are separate from API accounts. Video, ecommerce, advertising, payment fees and other business costs are additional.

The default routine route has $0.40 input and $1.60 output per million tokens; premium has $2 input and $8 output. Other configured defaults are Anthropic $1/$5 routine and $3/$15 premium, and Kimi K2.6 $0.95/$4. The provider with the cheapest configured combined rate is selected within a tier. Input/output mix can change which provider is actually cheapest; this simple rule is not an optimal cost estimator across every prompt.

The app estimates input conservatively from UTF-8 byte length, bounds output to at most 1,200 tokens, reserves cost before dispatch and settles from reported usage. Local cache hits cost zero. Per-call ledger estimates round up to a whole cent, so small calls intentionally overstate theoretical fractional-cent pricing. Anthropic reserves and estimates cache-write overhead conservatively rather than claiming cache discounts.

## Cost per role

Assume a 100,000-token month with 80% input/20% output, before per-call rounding. Tier 0 has no model bill. A routine month costs $0.064; a premium month costs $0.32 using the reference rates. These volumes are illustrative; each role's actual configured ceiling appears in the app.

| Agent | Tier 0 | Routine cloud | Premium cloud | Default ceiling |
| --- | --- | --- | --- | --- |
| Offer researcher | $0 | $0.064 | $0.32 | 100k |
| Competitor intelligence | $0 | $0.064 | $0.32 | 100k |
| Operations | $0 | $0.064 | $0.32 | 100k |
| Customer service | $0 | $0.064 | $0.32 | 100k |
| Social researcher | $0 | $0.064 | $0.32 | 100k |
| Content strategist | $0 | $0.064 | $0.32 | 100k |
| Video producer prompts | $0 | $0.064 | $0.32 | 100k; video generation excluded |
| Publishing | $0 | $0.064 | $0.32 | 100k; execution unavailable |
| Community manager | $0 | $0.064 | $0.32 | 100k |
| Monetization | $0 | $0.064 | $0.32 | 100k |
| Bookkeeper | $0 | $0.064 | $0.32 | 100k |
| Tax reserve | $0 | $0.064 | $0.32 | 100k |
| Portfolio manager | $0 | $0.064 | $0.32 | 100k |
| Manager | $0 | $0.128 | $0.64 | 200k |
| Guardian | $0 | $0.064 | $0.32 | 100k |
| Life Coach | $0 | $0.064 | $0.32 | 100k; cloud disabled in this release |

The configured roster permits 1.7 million tokens in aggregate, but no role automatically consumes its allowance. Roles run only when a task is explicitly dispatched. Four implemented local tasks can be used without a key.

## Launch and scale scenarios

| Assumption | Launch | Scale |
| --- | --- | --- |
| Total tasks/month | 1,000 | 10,000 |
| Deterministic/local | 750 | 7,500 |
| Routine calls, 2,500 input + 500 output | 230 | 2,300 |
| Premium calls, 6,000 input + 1,200 output | 20 | 200 |
| Unrounded model cost | $0.846 | $8.46 |
| Conservative cent-rounded ledger cost | $2.90 | $29.00 |
| Cloud tokens | 834k | 8.34m |

The 75% local share is a target assumption, not a measured result. Scale exceeds the default aggregate token ceilings and therefore needs an explicit budget review and higher per-agent limits. If all roles used their complete allowances at the illustrated input/output mix, the unrounded sum would be $1.088 at routine rates or $5.44 at premium rates, before request rounding and cache overhead. Role tier restrictions and readiness still apply.

The operating plan must also reserve subscriptions, ads, fulfillment, platform fees, refunds, professional advice and taxes from actual data. A low language-model cost does not establish a profitable business.

Kimi defaults were checked against the [official model list](https://platform.kimi.ai/docs/models), [parameter reference](https://platform.kimi.ai/docs/api/models-overview) and [published rates](https://platform.kimi.ai) on October 21, 2026. Kimi K2.5 was discontinued on August 31. Existing saved models and rates are preserved on update; the provider card offers an explicit K2.6 model/rate change. The model-list check is a read-only API request and does not generate text or mark the provider as tested by a draft.
