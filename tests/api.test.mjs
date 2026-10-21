import {test} from 'node:test';
import assert from 'node:assert/strict';
import { fixture,profile } from './helpers.mjs';
import { createApp } from '../server/app.mjs';

test('API requires a session and rejects foreign origins before mutations',async()=>{
  const f=fixture();const server=createApp(f.hub,{token:'test-session',development:true}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal((await fetch(base+'/api/state')).status,401);
    assert.equal((await fetch(base+'/api/session')).status,403);
    const bootstrap=await fetch(base+'/api/session',{headers:{'x-hub-bootstrap':'1'}});
    assert.equal((await bootstrap.json()).token,'test-session');
    assert.equal((await fetch(base+'/api/profile',{method:'POST',headers:{authorization:'Bearer test-session','content-type':'application/json',origin:'https://attacker.example'},body:JSON.stringify(profile)})).status,403);
    assert.equal((await fetch(base+'/api/profile',{method:'POST',headers:{authorization:'Bearer test-session','content-type':'application/json'},body:JSON.stringify(profile)})).status,200);
    const state=await fetch(base+'/api/state',{headers:{authorization:'Bearer test-session'}});
    assert.equal((await state.json()).profile.name,'Alex');
    const bad=await fetch(base+'/api/ledger',{method:'POST',headers:{authorization:'Bearer test-session','content-type':'application/json'},body:'{}'});
    assert.equal(bad.status,400);
  }finally{await new Promise(resolve=>server.close(resolve));f.close();}
});

test('business connection and Shopify action routes reject missing sessions and foreign origins',async()=>{
  let calls=0;const f=fixture({fetchImpl:async()=>{calls++;throw new Error('Unexpected external request');}});
  const server=createApp(f.hub,{token:'test-session'}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;const headers={authorization:'Bearer test-session','content-type':'application/json'};
  try{
    for(const path of ['/connections/shopify','/connections/shopify/check','/connections/shopify/disconnect','/shopify/page','/shopify/page/edit','/shopify/page/review','/shopify/page/check','/shopify/page/confirm-not-created','/shopify/page/resolve-review']){
      assert.equal((await fetch(base+'/api'+path,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);
      assert.equal((await fetch(base+'/api'+path,{method:'POST',headers:{...headers,origin:'https://attacker.example'},body:'{}'})).status,403);
    }
    f.hub.saveProfile(profile);
    const response=await fetch(base+'/api/approvals',{method:'POST',headers,body:JSON.stringify({agentId:'publishing',kind:'publish',title:'A forged store action',why:'Fixture',recommendation:'Fixture',content:'Ordinary private content',costCents:0,risk:'low',expectedOutcome:'Fixture',actionType:'shopify-draft-page',receipt:{id:'fake'}})});
    const a=await response.json();assert.equal(response.status,200);assert.equal(a.actionType,undefined);
    const decision=await fetch(base+`/api/approvals/${a.id}/decision`,{method:'POST',headers,body:JSON.stringify({version:1,decision:'approve'})});
    assert.equal((await decision.json()).execution,'connection_required');assert.equal(calls,0);
  }finally{await new Promise(resolve=>server.close(resolve));f.close();}
});

test('launch routes require the owner session and same origin, and public jobs cannot forge workflow links',async()=>{
  const f=fixture();const server=createApp(f.hub,{token:'test-session'}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const headers={authorization:'Bearer test-session','content-type':'application/json'};
  try{
    f.hub.saveProfile(profile);
    for(const path of ['/launch/brief','/launch/drafts','/launch/review']){
      assert.equal((await fetch(base+'/api'+path,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);
      assert.equal((await fetch(base+'/api'+path,{method:'POST',headers:{...headers,origin:'https://attacker.example'},body:'{}'})).status,403);
    }
    assert.equal(f.hub.launchState().brief,null);assert.equal(f.hub.jobs().length,0);assert.equal(f.hub.approvals().length,0);
    const res=await fetch(base+'/api/jobs',{method:'POST',headers,body:JSON.stringify({agentId:'manager',kind:'draft',prompt:'A private gardening draft',requestId:'forged',title:'Forged launch title',workflow:{type:'launch',batchId:'forged',stage:'copy'}})});
    assert.equal(res.status,200);const job=await res.json();assert.equal(job.workflow,undefined);assert.equal(job.title,undefined);await f.hub.drain();
  }finally{await new Promise(resolve=>server.close(resolve));f.close();}
});

test('chat routes require an owner session and same origin and reject forged workflows',async()=>{
  let calls=0;const f=fixture({fetchImpl:async()=>{calls++;throw new Error('Unexpected transport');}});f.hub.saveProfile(profile);
  const server=createApp(f.hub,{token:'test-session'}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;const headers={authorization:'Bearer test-session','content-type':'application/json'};
  try{
    for(const [path,method] of [['/chats','GET'],['/chats/missing','GET'],['/chat/messages','POST'],['/chat/review','POST']]){
      const options={method,...(method==='POST'?{body:'{}'}:{})};
      assert.equal((await fetch(base+'/api'+path,{...options,headers:{'content-type':'application/json'}})).status,401);
      assert.equal((await fetch(base+'/api'+path,{...options,headers:{...headers,origin:'https://attacker.example'}})).status,403);
    }
    const forged=await fetch(base+'/api/chat/messages',{method:'POST',headers,body:JSON.stringify({agentId:'manager',content:'A business question',requestId:'forged',workflow:{type:'shopify-action',approvalId:'fake',approvalVersion:1}})});assert.equal(forged.status,400);assert.equal(f.hub.chatConversations().length,0);
    const sent=await fetch(base+'/api/chat/messages',{method:'POST',headers,body:JSON.stringify({agentId:'manager',content:'A gardening question',requestId:'message'})});assert.equal(sent.status,200);const c=await sent.json();await f.hub.drain();
    assert.equal((await (await fetch(base+'/api/chats',{headers})).json()).length,1);
    const saved=await (await fetch(base+'/api/chats/'+c.id,{headers})).json();assert.equal(saved.turns[0].content,'A gardening question');assert.equal(saved.turns[0].job.status,'blocked');assert.equal(calls,0);
  }finally{await new Promise(resolve=>server.close(resolve));f.close();}
});
