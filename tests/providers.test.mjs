import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,profile} from './helpers.mjs';
import {createApp} from '../server/app.mjs';
import {callProvider,DEFAULT_PROVIDERS} from '../server/providers.mjs';

const completion=()=>new Response(JSON.stringify({choices:[{message:{content:'A practical first step.'},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:20}}));

test('new Kimi tasks use the current general-purpose model and non-thinking request format',async()=>{
  let request;
  const f=fixture({fetchImpl:async(url,options)=>{request={url,...options};return completion();}});
  try{
    f.hub.saveProfile(profile);f.hub.saveProvider('moonshot',{enabled:true,key:'fixture-key'});
    f.hub.enqueue({agentId:'manager',kind:'brainstorm',prompt:'Plan the first week.',requestId:'current-kimi'});
    await f.hub.drain();
    assert.equal(f.hub.jobs()[0].status,'completed');
    assert.equal(request.url,'https://api.moonshot.ai/v1/chat/completions');
    const body=JSON.parse(request.body);
    assert.equal(body.model,'kimi-k2.6');
    assert.deepEqual(body.thinking,{type:'disabled'});
    assert.equal(body.max_tokens,1200);
    const provider=f.hub.providers().find(p=>p.id==='moonshot');
    assert.equal(provider.inputPerMillion,.95);assert.equal(provider.premiumOutputPerMillion,4);
  }finally{f.close();}
});

test('a structured model-not-found rejection releases its reservation without retry or secret disclosure',async()=>{
  let calls=0;
  const f=fixture({fetchImpl:async()=>{calls++;return new Response(JSON.stringify({error:{type:'resource_not_found_error',message:'Do not echo fixture-key or private prompt.'}}),{status:404});}});
  try{
    f.hub.saveProfile(profile);f.hub.saveProvider('moonshot',{enabled:true,key:'fixture-key'});
    f.hub.enqueue({agentId:'manager',kind:'brainstorm',prompt:'Private prompt.',requestId:'missing-model'});
    await f.hub.drain();
    const job=f.hub.jobs()[0];
    assert.equal(job.status,'failed');assert.equal(calls,1);
    assert.match(job.error,/HTTP 404/);assert.match(job.error,/model/i);assert.match(job.error,/reservation.*released/i);
    assert.doesNotMatch(job.error,/unknown|fixture-key|private prompt/i);
    assert.equal(f.hub.unknownUsage().length,0);
    assert.equal(f.hub.finance().usage[0].reservedCents,0);
    assert.equal(f.hub.finance().expenseCents,0);
    assert.equal(f.hub.store.db.prepare('SELECT COUNT(*) AS n FROM cache').get().n,0);
  }finally{f.close();}
});

test('ambiguous HTTP errors retain their billing reservation',async()=>{
  for(const response of [()=>new Response('<html>Missing gateway</html>',{status:404}),()=>new Response(JSON.stringify({error:{type:'server_error'}}),{status:500}),()=>new Response(JSON.stringify({error:{type:'resource_not_found_error'},usage:{completion_tokens:10}}),{status:404})]){
    const f=fixture({fetchImpl:async()=>response()});
    try{
      f.hub.saveProfile(profile);f.hub.saveProvider('moonshot',{enabled:true,key:'fixture-key'});
      f.hub.enqueue({agentId:'manager',kind:'brainstorm',prompt:'A short plan.',requestId:'ambiguous'});await f.hub.drain();
      assert.match(f.hub.jobs()[0].error,/unknown/i);
      assert.equal(f.hub.unknownUsage().length,1);assert.ok(f.hub.finance().usage[0].reservedCents>0);
    }finally{f.close();}
  }
});

test('documented authentication and permission rejections release reservations without exposing provider text',async()=>{
  for(const [status,type] of [[401,'invalid_authentication_error'],[403,'permission_denied_error']]){
    const f=fixture({fetchImpl:async()=>new Response(JSON.stringify({error:{type,message:'Private provider response'}}),{status})});
    try{
      f.hub.saveProfile(profile);f.hub.saveProvider('moonshot',{enabled:true,key:'fixture-key'});
      f.hub.enqueue({agentId:'manager',kind:'brainstorm',prompt:'Plan an offer.',requestId:'rejected'});await f.hub.drain();
      assert.equal(f.hub.unknownUsage().length,0);assert.equal(f.hub.finance().usage[0].reservedCents,0);
      assert.match(f.hub.jobs()[0].error,new RegExp(`HTTP ${status}`));
      assert.doesNotMatch(f.hub.jobs()[0].error,/Private provider response/);
    }finally{f.close();}
  }
});

test('Kimi model discovery uses the saved key, requires a session, and performs no generation or billing mutation',async()=>{
  const requests=[];
  const f=fixture({fetchImpl:async(url,options)=>{requests.push({url,...options});return new Response(JSON.stringify({data:[{id:'kimi-k3'},{id:'kimi-k2.6'},{id:'kimi-k2.6'},{id:'<invalid-model>'}]}));}});
  f.hub.saveProfile(profile);f.hub.saveProvider('moonshot',{enabled:true,key:'fixture-key',model:'kimi-k2.5',premiumModel:'kimi-k2.5'});
  const server=createApp(f.hub,{token:'fixture-session'}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/providers/moonshot/models`;
  try{
    assert.equal((await fetch(url,{method:'POST'})).status,401);assert.equal(requests.length,0);
    const response=await fetch(url,{method:'POST',headers:{authorization:'Bearer fixture-session'}});
    assert.equal(response.status,200);
    const result=await response.json();assert.deepEqual(result.models,['kimi-k2.6','kimi-k3']);
    assert.doesNotMatch(JSON.stringify(result),/fixture-key/);
    assert.equal(requests[0].url,'https://api.moonshot.ai/v1/models');assert.equal(requests[0].method,'GET');
    assert.equal(requests[0].headers.authorization,'Bearer fixture-key');assert.equal(requests[0].body,undefined);
    assert.equal(f.hub.jobs().length,0);assert.equal(f.hub.finance().usage.length,0);
    const provider=f.hub.providers().find(p=>p.id==='moonshot');
    assert.equal(provider.model,'kimi-k2.5');assert.ok(!provider.verifiedAt);
  }finally{await new Promise(resolve=>server.close(resolve));f.close();}
});

test('model discovery rejects a missing saved key before transport',async()=>{
  let calls=0;const f=fixture({fetchImpl:async()=>{calls++;return completion();}});
  try{
    f.hub.saveProfile(profile);
    await assert.rejects(()=>f.hub.checkProviderModels('moonshot'),/save|connect|key/i);
    assert.equal(calls,0);
  }finally{f.close();}
});

test('Kimi model request parameters follow the selected model family',async()=>{
  for(const model of ['kimi-k3','kimi-k2.7-code']){
    let body;
    await callProvider({provider:{...DEFAULT_PROVIDERS.find(p=>p.id==='moonshot'),model},key:'fixture-key',system:'System',prompt:'Task',tier:1,fetchImpl:async(url,options)=>{body=JSON.parse(options.body);return completion();}});
    assert.equal(body.thinking,undefined);
    assert.equal(body.reasoning_effort,model==='kimi-k3'?'low':undefined);
  }
});
