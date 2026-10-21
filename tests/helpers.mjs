import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHub } from '../server/hub.mjs';

export const profile = {
  name:'Alex', tone:'casual', goals:'Build a sustainable independent business', incomeTargetCents:300000,
  timeline:'12 months', weeklyHours:3, startupBudgetCents:100000, operatingBudgetCents:50000,
  apiBudgetCents:5000, hardCapCents:60000, risk:'conservative', jurisdiction:'US, CA', currency:'USD',
  stage:'chosen', model:'digital', offer:'Practical gardening guides', assets:'Writing and gardening',
  brand:'Green days', experience:'Some experience', confirmed:true,
};
export function fixture(options={}) {
  const dataDir=mkdtempSync(join(tmpdir(),'hub-test-'));
  const hub=createHub({dataDir,...options});
  return {hub,dataDir, close(){hub.close();rmSync(dataDir,{recursive:true,force:true});}};
}
