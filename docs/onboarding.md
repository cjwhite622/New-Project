# Interview and owner profile

The Manager interview runs locally and saves progress after answers change and after each Continue. It makes no paid calls. All owner and business answers are editable in Settings after confirmation. The Life Coach segment is a separate private form and never enters this profile.

| Step | Conversation | Saved fields |
| --- | --- | --- |
| 1 | What should we call you? | name |
| 2 | Where are you starting? | experience |
| 3 | What would this business make possible? | goals, monthly income target, timeline |
| 4 | How much time do you want to give it? | weekly hours |
| 5 | Give your team clear spending limits. | startup, operating, API and hard budgets, currency |
| 6 | What context should we plan around? | risk preference, country/region |
| 7 | Tell me about your business. | existing, chosen or recommendation requested |
| 8 | Which direction do you choose? | explicit business model selection |
| 9 | What do you offer and already have? | offer, audience, existing tools/assets and first priority |
| 10 | What should the brand feel like? | working brand name and conversational tone |
| 11 | Here is the plan. | confirmation before activation |

Recommendation mode offers services, digital products and content with qualitative tradeoffs. It does not perform live market research or promise a time to revenue. The owner explicitly selects a direction. Existing-business answers can describe current revenue, costs, platforms and bottlenecks; structured data imports happen in Finance.

The authoritative executable schema is `profileSchema` in `server/validation.mjs`:

```ts
type OwnerProfile = {
  name: string;
  tone: 'casual' | 'professional';
  experience: string;
  goals: string;
  incomeTargetCents: number;
  timeline: string;
  weeklyHours: number; // 0.25–80
  startupBudgetCents: number;
  operatingBudgetCents: number;
  apiBudgetCents: number;
  hardCapCents: number;
  risk: 'conservative' | 'balanced' | 'aggressive';
  jurisdiction: string;
  currency: 'USD' | 'GBP' | 'EUR' | 'CAD' | 'AUD';
  stage: 'existing' | 'chosen' | 'recommend';
  model: 'commerce' | 'services' | 'content' | 'digital' | 'agency' | 'existing';
  offer: string;
  assets: string;
  brand: string;
  confirmed: true;
};
```

Amounts are nonnegative integer cents, capped at one billion cents. API ≤ operating ≤ hard cap. Budget reductions must also cover recorded costs and outstanding reservations. Currency locks after any ledger or provider-usage record exists.

The personal segment asks about life goals, health/nutrition, sleep, relationships, growth, schedule, notes and check-in preference. It is a local journal in this release. Automated check-ins, external calendar actions and cloud Life Coach conversations remain later milestones.

Further interview refinements include separate AI/business experience, approval availability and time zone, structured existing-business metrics, quantitative option estimates backed by live research, and a guided connection plan. These are documented scope gaps, not implied finished behavior.
