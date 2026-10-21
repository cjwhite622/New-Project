import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, profile } from './helpers.mjs';
import { memoryVault } from '../server/providers.mjs';

const cloudResponse=()=>new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'An actionable business draft.'}]}],usage:{input_tokens:100,output_tokens:50}}),{status:200,headers:{'content-type':'application/json'}});
test('local job is idempotent and traverses durable events without cloud costs',async()=>{
  const f=fixture();try{
    f.hub.saveProfile(profile);
    const input={agentId:'manager',kind:'digest',prompt:'',requestId:'same-task'};
    const one=f.hub.enqueue(input);const two=f.hub.enqueue(input);assert.equal(one.id,two.id);
    await f.hub.drain();
    const job=f.hub.jobs()[0];assert.equal(job.status,'completed');assert.equal(job.tier,0);assert.equal(job.inputTokens,0);
    assert.match(job.result,/recorded/i);assert.equal(f.hub.events().filter(e=>e.taskType==='agent.completed').length,1);
  }finally{f.close();}
});
test('approval binds version, rejects replay, and does not pretend to publish',async()=>{
  const f=fixture();try{
    f.hub.saveProfile(profile);
    const a=f.hub.propose({agentId:'strategist',kind:'publish',title:'A launch post',why:'Introduce the guide',recommendation:'Review the draft',content:'Gardening guide available',costCents:0,risk:'medium',expectedOutcome:'Audience feedback'});
    const edited=f.hub.editApproval(a.id,{version:1,content:'Revised gardening guide draft'});
    assert.throws(()=>f.hub.decideApproval(a.id,{version:1,decision:'approve'}),/changed/i);
    assert.equal(f.hub.decideApproval(a.id,{version:edited.version,decision:'approve'}).status,'approved');
    assert.throws(()=>f.hub.decideApproval(a.id,{version:edited.version,decision:'approve'}),/already/i);
    assert.equal(f.hub.jobs().length,0);
    assert.equal(f.hub.approvals()[0].execution,'connection_required');
  }finally{f.close();}
});
test('cloud call records real usage, caches the response, and keeps keys off state',async()=>{
  const vault=memoryVault();let calls=0;
  const f=fixture({vault,fetchImpl:async()=>{calls++;return cloudResponse();}});try{
    f.hub.saveProfile(profile);f.hub.saveProvider('openai',{key:'test-secret',enabled:true});
    f.hub.enqueue({agentId:'strategist',kind:'draft',prompt:'Draft a short launch post',requestId:'cloud-1'});
    await f.hub.drain();
    assert.equal(f.hub.jobs()[0].status,'completed');assert.equal(f.hub.jobs()[0].inputTokens,100);
    assert.equal(f.hub.finance().apiSpendCents,1);
    f.hub.enqueue({agentId:'strategist',kind:'draft',prompt:'Draft a short launch post',requestId:'cloud-2'});
    await f.hub.drain();assert.equal(calls,1);assert.equal(f.hub.jobs()[0].cached,true);
    assert.ok(!JSON.stringify(f.hub.state()).includes('test-secret'));
  }finally{f.close();}
});
test('pause aborts active cloud work, keeps reservations for unknown billing, and blocks new jobs',async()=>{
  let started;const ready=new Promise(resolve=>{started=resolve;});
  const f=fixture({fetchImpl:async(url,{signal})=>{started();return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});});}});try{
    f.hub.saveProfile(profile);f.hub.saveProvider('openai',{key:'test',enabled:true});
    f.hub.enqueue({agentId:'manager',kind:'brainstorm',prompt:'Find an opportunity',requestId:'abort'});
    const work=f.hub.drain();await ready;f.hub.setPaused(true);await work;
    assert.equal(f.hub.jobs()[0].status,'failed');
    assert.match(f.hub.jobs()[0].error,/unknown/i);
    assert.throws(()=>f.hub.enqueue({agentId:'manager',kind:'digest',prompt:'',requestId:'blocked'}),/paused/i);
    assert.ok(f.hub.finance().usage[0].reservedCents>0);
  }finally{f.close();}
});
test('zero API budget blocks calls before transport and exhausted agent budget escalates',async()=>{
  let calls=0;const f=fixture({fetchImpl:async()=>{calls++;return cloudResponse();}});try{
    f.hub.saveProfile({...profile,apiBudgetCents:0});f.hub.saveProvider('openai',{key:'test',enabled:true});
    f.hub.enqueue({agentId:'strategist',kind:'draft',prompt:'Write a draft',requestId:'limit'});
    await f.hub.drain();assert.equal(calls,0);assert.equal(f.hub.jobs()[0].status,'blocked');
    assert.equal(f.hub.approvals().length,1);
  }finally{f.close();}
});
test('80 percent budget downgrades premium tasks and 100 percent pauses',async()=>{
  let model;const f=fixture({fetchImpl:async(url,options)=>{model=JSON.parse(options.body).model;return cloudResponse();}});try{
    f.hub.saveProfile(profile);f.hub.saveProvider('openai',{key:'test',enabled:true});
    // Leave room for the full confirmed business context at the 80% threshold.
    f.hub.saveAgent('manager',{tokenBudget:30000});
    f.hub.store.db.prepare('INSERT INTO usage VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run('seed','seed','manager',new Date().toISOString().slice(0,7),24000,0,0,0,0,'settled','openai',new Date().toISOString());
    f.hub.enqueue({agentId:'manager',kind:'brainstorm',prompt:'A practical growth idea',requestId:'downgrade'});
    await f.hub.drain();assert.equal(f.hub.jobs()[0].status,'completed');assert.equal(model,'gpt-4.1-mini');assert.equal(f.hub.jobs()[0].tier,1);
    f.hub.saveAgent('manager',{tokenBudget:24150});
    f.hub.enqueue({agentId:'manager',kind:'brainstorm',prompt:'Another idea',requestId:'exhausted'});
    await f.hub.drain();assert.equal(f.hub.jobs()[0].status,'blocked');
  }finally{f.close();}
});
