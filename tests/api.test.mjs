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
