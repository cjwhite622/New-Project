import { z } from 'zod';
export class HubError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const money=z.number().int('Money must use integer cents').min(0).max(1_000_000_000);
export const text=z.string().trim().min(1).max(5000);
export const profileSchema=z.object({
  name:text.max(80),tone:z.enum(['casual','professional']),experience:text,
  goals:text,incomeTargetCents:money,timeline:text.max(200),weeklyHours:z.number().min(.25).max(80),
  startupBudgetCents:money,operatingBudgetCents:money,apiBudgetCents:money,hardCapCents:money,
  risk:z.enum(['conservative','balanced','aggressive']),jurisdiction:text.max(150),currency:z.enum(['USD','GBP','EUR','CAD','AUD']),
  stage:z.enum(['existing','chosen','recommend']),model:z.enum(['commerce','services','content','digital','agency','existing']),
  offer:text,assets:z.string().max(5000),brand:text.max(150),confirmed:z.literal(true),
}).superRefine((p,ctx)=>{
  if(p.apiBudgetCents>p.operatingBudgetCents || p.operatingBudgetCents>p.hardCapCents)ctx.addIssue({code:'custom',message:'API budget must fit inside operating budget, and operating budget inside the hard cap.'});
});
export const ledgerSchema=z.object({
  date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Use an ISO date').refine(s=>{const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;},'Invalid date'),
  kind:z.enum(['income','expense']),amountCents:money.refine(n=>n>0,'Amount must be positive'),
  category:text.max(80),description:text.max(1000),source:z.enum(['manual','csv']),externalId:text.max(200),
});
export const parse=(schema,value)=>{
  const result=schema.safeParse(value);
  if(!result.success)throw new HubError(result.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '));
  return result.data;
};
