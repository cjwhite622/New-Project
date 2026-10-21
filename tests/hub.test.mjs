import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHub } from '../server/hub.mjs';

import {profile,fixture} from './helpers.mjs';
test('onboarding is resumable and agents cannot run before confirmation', async()=>{
  const f=fixture();
  try {
    f.hub.saveInterview({step:2,answers:{name:'Alex'}});
    assert.equal(f.hub.state().interview.answers.name,'Alex');
    assert.throws(()=>f.hub.enqueue({agentId:'manager',kind:'digest',prompt:'',requestId:'pre'}),/interview/i);
    assert.throws(()=>f.hub.saveProfile({...profile,apiBudgetCents:70000}),/budget/i);
    f.hub.saveProfile(profile);
    assert.equal(f.hub.state().profile.name,'Alex');
    assert.equal(f.hub.state().agents.length,16);
  } finally {f.close();}
});
test('money uses cents, separates unverified income and reserves positive profit only',()=>{
  const f=fixture();try{
    f.hub.saveProfile(profile);
    const row={date:new Date().toISOString().slice(0,10),kind:'income',amountCents:10000,category:'sales',description:'Guide sale',source:'manual',externalId:'sale-1'};
    f.hub.addLedger(row);f.hub.addLedger(row);
    f.hub.addLedger({...row,kind:'expense',amountCents:2000,externalId:'fee-1'});
    const finance=f.hub.finance();
    assert.equal(finance.revenueCents,10000);assert.equal(finance.expenseCents,2000);
    assert.equal(finance.profitCents,8000);assert.equal(finance.taxReserveCents,2000);
    assert.equal(finance.verifiedRevenueCents,0);assert.equal(f.hub.proof().incomeProof,'not_verified');
    assert.throws(()=>f.hub.addLedger({...row,amountCents:1.3}),/integer/i);
    assert.throws(()=>f.hub.addLedger({...row,date:'2026-02-31'}),/date/i);
  }finally{f.close();}
});
test('CSV import is atomic, supports quoted commas, and deduplicates repeated rows',()=>{
  const f=fixture();try{
    f.hub.saveProfile(profile);
    const csv='date,kind,amount,category,description,reference\n2026-10-01,income,125.50,sales,"A guide, sold",s1\n2026-10-02,expense,20.00,tools,Subscription,s2';
    assert.equal(f.hub.previewCsv(csv).length,2);assert.equal(f.hub.importCsv(csv).imported,2);
    assert.equal(f.hub.importCsv(csv).imported,0);
    assert.throws(()=>f.hub.importCsv(csv+'\n2026-10-03,income,broken,sales,Oops,s3'),/amount/i);
    assert.equal(f.hub.ledger().length,2);
  }finally{f.close();}
});
test('private notes stay out of business state, audit, and evidence reports',()=>{
  const f=fixture();try{
    f.hub.saveProfile(profile);
    f.hub.personal.save({goals:'PRIVATE health detail',notes:'PRIVATE relationship detail',checkIn:'Weekly'});
    assert.equal(f.hub.personal.get().goals,'PRIVATE health detail');
    assert.ok(!JSON.stringify(f.hub.state()).includes('PRIVATE'));
    assert.ok(!JSON.stringify(f.hub.audit()).includes('PRIVATE'));
    assert.ok(!JSON.stringify(f.hub.proof()).includes('PRIVATE'));
    assert.throws(()=>f.hub.agentMemory('manager','life-coach'),/private/i);
    assert.equal(f.hub.verifyAudit().valid,true);
  }finally{f.close();}
});
test('owner profile and ledger persist after restart',()=>{
  const f=fixture();f.hub.saveProfile(profile);f.hub.close();
  const restarted=createHub({dataDir:f.dataDir});assert.equal(restarted.state().profile.brand,'Green days');
  restarted.close();rmSync(f.dataDir,{recursive:true,force:true});
});
