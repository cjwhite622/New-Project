import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,profile} from './helpers.mjs';
import {createHub} from '../server/hub.mjs';

const direction={audience:'Apartment gardeners',transformation:'Grow herbs in a small balcony space',format:'toolkit',channel:'text'};
const completion=text=>new Response(JSON.stringify({output:[{content:[{type:'output_text',text}]}],status:'completed',usage:{input_tokens:100,output_tokens:30}}));
const connect=f=>{f.hub.saveProfile(profile);f.hub.saveProvider('openai',{key:'fixture-key',enabled:true});};

test('business requests receive confirmed time and spending constraints without personal data or keys',async()=>{
  let body;
  const f=fixture({fetchImpl:async(url,options)=>{body=JSON.parse(options.body);return completion('A short plan.');}});
  try{
    connect(f);f.hub.personal.save({goals:'PRIVATE_COACH_GOAL',notes:'PRIVATE_JOURNAL',checkIn:'Weekly'});
    f.hub.store.set('profile',{...profile,privateFutureField:'PRIVATE_FUTURE_FIELD'});
    f.hub.enqueue({agentId:'manager',kind:'brainstorm',prompt:'Plan a week.',requestId:'constraints'});await f.hub.drain();
    assert.match(body.instructions,/"weeklyHours":3/);assert.match(body.instructions,/"startupBudgetCents":100000/);
    assert.match(body.instructions,/"operatingBudgetCents":50000/);assert.match(body.instructions,/"apiBudgetCents":5000/);
    assert.match(body.instructions,/"hardCapCents":60000/);assert.match(body.instructions,/"incomeTargetCents":300000/);
    assert.match(body.instructions,/review.*ideas/i);assert.match(body.instructions,/do not invent.*hours/i);
    assert.doesNotMatch(JSON.stringify(body),/PRIVATE_COACH_GOAL|PRIVATE_JOURNAL|PRIVATE_FUTURE_FIELD|fixture-key/);
  }finally{f.close();}
});

test('changing owner constraints invalidates cloud cache while unchanged constraints retain cache hits',async()=>{
  let calls=0;const f=fixture({fetchImpl:async()=>{calls++;return completion('A plan.');}});
  try{
    connect(f);
    for(let i=0;i<3;i++){
      if(i===1)f.hub.saveProfile({...profile,weeklyHours:1,apiBudgetCents:6000});
      f.hub.enqueue({agentId:'manager',kind:'brainstorm',prompt:'Plan a week.',requestId:'cache-'+i});await f.hub.drain();
    }
    assert.equal(calls,2);assert.equal(f.hub.jobs()[0].cached,true);
  }finally{f.close();}
});

test('launch direction is validated, saved idempotently and protected against stale edits',()=>{
  const f=fixture();try{
    assert.throws(()=>f.hub.saveLaunchBrief({version:0,...direction}),/interview/i);
    f.hub.saveProfile(profile);
    const brief=f.hub.saveLaunchBrief({version:0,...direction});assert.equal(brief.version,1);
    assert.equal(f.hub.saveLaunchBrief({version:0,...direction}).version,1);
    assert.throws(()=>f.hub.saveLaunchBrief({version:0,...direction,audience:'A changed audience'}),/changed|refresh/i);
    assert.throws(()=>f.hub.saveLaunchBrief({version:1,...direction,format:'unapproved-platform'}),/format/i);
    assert.equal(f.hub.jobs().length,0);
    assert.equal(f.hub.launchState().brief.direction.audience,direction.audience);
  }finally{f.close();}
});

test('one explicit launch request atomically queues three jobs and survives duplicate delivery and restart',()=>{
  const f=fixture();try{
    f.hub.saveProfile(profile);f.hub.saveLaunchBrief({version:0,...direction});
    const a=f.hub.prepareLaunchDrafts({version:1,requestId:'one-batch'});
    const replay=f.hub.prepareLaunchDrafts({version:1,requestId:'one-batch'});
    assert.equal(replay.id,a.id);assert.equal(f.hub.jobs().length,3);
    assert.deepEqual(a.stages.map(s=>s.agentId),['research','strategist','manager']);
    assert.throws(()=>f.hub.prepareLaunchDrafts({version:1,requestId:'second-batch'}),/already.*progress|already.*queued/i);
    const again=createHub({dataDir:f.dataDir});try{assert.equal(again.launchState().batch.id,a.id);assert.equal(again.jobs().length,3);}finally{again.close();}
  }finally{f.close();}
});

test('launch queue creation leaves no partial work when an agent is unavailable or the team is paused',()=>{
  const f=fixture();try{
    f.hub.saveProfile(profile);f.hub.saveLaunchBrief({version:0,...direction});
    f.hub.saveAgent('strategist',{tokenBudget:100000,enabled:false});
    assert.throws(()=>f.hub.prepareLaunchDrafts({version:1,requestId:'disabled'}),/unavailable|disabled/i);
    assert.equal(f.hub.jobs().length,0);assert.equal(f.hub.launchState().batch,null);
    f.hub.saveAgent('strategist',{tokenBudget:100000,enabled:true});f.hub.setPaused(true);
    assert.throws(()=>f.hub.prepareLaunchDrafts({version:1,requestId:'paused'}),/paused/i);
    assert.equal(f.hub.jobs().length,0);
  }finally{f.close();}
});

test('launch stages share completed work, create one review pack and never publish after approval',async()=>{
  const requests=[];
  const f=fixture({fetchImpl:async(url,options)=>{requests.push(JSON.parse(options.body));return completion('Artifact '+requests.length);}});
  try{
    connect(f);f.hub.saveLaunchBrief({version:0,...direction});f.hub.prepareLaunchDrafts({version:1,requestId:'complete'});
    await f.hub.drain();const batch=f.hub.launchState().batch;
    assert.ok(batch.stages.every(s=>s.job.status==='completed'));assert.equal(requests.length,3);
    assert.match(requests[1].instructions,/Artifact 1/);assert.match(requests[2].instructions,/Artifact 1/);assert.match(requests[2].instructions,/Artifact 2/);
    const review=f.hub.reviewLaunchPack({batchId:batch.id});
    assert.equal(f.hub.reviewLaunchPack({batchId:batch.id}).id,review.id);assert.equal(f.hub.approvals().length,1);
    for(const text of ['Artifact 1','Artifact 2','Artifact 3'])assert.ok(review.content.includes(text));
    f.hub.decideApproval(review.id,{version:1,decision:'approve'});
    assert.equal(f.hub.approvals()[0].execution,'connection_required');assert.equal(requests.length,3);
    assert.equal(f.hub.finance().apiSpendCents,3);
  }finally{f.close();}
});

test('changed launch direction or owner constraints block queued stages before any provider call',async()=>{
  for(const change of ['brief','profile']){
    let calls=0;const f=fixture({fetchImpl:async()=>{calls++;return completion('An artifact.');}});
    try{
      connect(f);f.hub.saveLaunchBrief({version:0,...direction});f.hub.prepareLaunchDrafts({version:1,requestId:'stale'});
      if(change==='brief')f.hub.saveLaunchBrief({version:1,...direction,transformation:'A revised gardening outcome'});
      else f.hub.saveProfile({...profile,weeklyHours:1});
      await f.hub.drain();const batch=f.hub.launchState().batch;
      assert.equal(calls,0);assert.ok(batch.outdated);assert.ok(batch.stages.every(s=>s.job.status==='blocked'));
      assert.throws(()=>f.hub.reviewLaunchPack({batchId:batch.id}),/changed|fresh|outdated/i);
    }finally{f.close();}
  }
});

test('an uncertain first-stage outcome blocks dependent work, review and another batch until billing is resolved',async()=>{
  let calls=0;const f=fixture({fetchImpl:async()=>{calls++;throw new Error('Connection lost');}});
  try{
    connect(f);f.hub.saveLaunchBrief({version:0,...direction});f.hub.prepareLaunchDrafts({version:1,requestId:'uncertain'});
    await f.hub.drain();const batch=f.hub.launchState().batch;
    assert.equal(calls,1);assert.equal(batch.stages[0].job.status,'failed');
    assert.ok(batch.stages.slice(1).every(s=>s.job.status==='blocked'));
    assert.throws(()=>f.hub.reviewLaunchPack({batchId:batch.id}),/complete|draft/i);
    assert.throws(()=>f.hub.prepareLaunchDrafts({version:1,requestId:'retry'}),/billing/i);
    assert.equal(f.hub.jobs().length,3);
    f.hub.resolveUsage(batch.stages[0].job.id,{costCents:0,inputTokens:0,outputTokens:0,note:'Fixture provider billing check confirms no charge.'});
    f.hub.prepareLaunchDrafts({version:1,requestId:'after-billing-review'});assert.equal(f.hub.jobs().length,6);assert.equal(calls,1);
  }finally{f.close();}
});

test('disabling an agent after queue creation blocks its stage and downstream work before dispatch',async()=>{
  let calls=0;const f=fixture({fetchImpl:async()=>{calls++;return completion('A completed offer brief.');}});
  try{
    connect(f);f.hub.saveLaunchBrief({version:0,...direction});f.hub.prepareLaunchDrafts({version:1,requestId:'disable-queued'});
    f.hub.saveAgent('strategist',{tokenBudget:100000,enabled:false});await f.hub.drain();const batch=f.hub.launchState().batch;
    assert.equal(calls,1);assert.equal(batch.stages[0].job.status,'completed');assert.ok(batch.stages.slice(1).every(s=>s.job.status==='blocked'));
  }finally{f.close();}
});

test('an oversized launch pack cannot silently truncate the content submitted for approval',async()=>{
  const f=fixture({fetchImpl:async()=>completion('An unusually long provider draft. '.repeat(300))});
  try{
    connect(f);f.hub.saveLaunchBrief({version:0,...direction});f.hub.prepareLaunchDrafts({version:1,requestId:'oversized'});await f.hub.drain();
    const batch=f.hub.launchState().batch;assert.ok(batch.stages.every(s=>s.job.status==='completed'));
    assert.throws(()=>f.hub.reviewLaunchPack({batchId:batch.id}),/too long|individual/i);assert.equal(f.hub.approvals().length,0);
  }finally{f.close();}
});
