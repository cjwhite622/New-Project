import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fixture,profile} from './helpers.mjs';
import {createHub} from '../server/hub.mjs';
import {callProvider} from '../server/providers.mjs';
import {createApp} from '../server/app.mjs';

test('a reused finance reference with changed content is rejected, not silently ignored',()=>{
 const f=fixture();try{f.hub.saveProfile(profile);const row={date:'2026-10-17',kind:'income',amountCents:100,category:'sales',description:'A sale',source:'manual',externalId:'once'};f.hub.addLedger(row);assert.throws(()=>f.hub.addLedger({...row,amountCents:1000}),/reference/i);assert.equal(f.hub.ledger()[0].amountCents,100);}finally{f.close();}
});
test('currency cannot be relabeled after finance records exist',()=>{
 const f=fixture();try{f.hub.saveProfile(profile);f.hub.addLedger({date:'2026-10-17',kind:'income',amountCents:100,category:'sales',description:'A sale',source:'manual',externalId:'one'});assert.throws(()=>f.hub.saveProfile({...profile,currency:'EUR'}),/currency/i);}finally{f.close();}
});
test('active usage locks currency and prevents budgets below committed reservations',async()=>{
 let started;const ready=new Promise(resolve=>{started=resolve;});const f=fixture({fetchImpl:async(url,{signal})=>{started();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))));}});
 try{f.hub.saveProfile(profile);f.hub.saveProvider('openai',{key:'test',enabled:true});f.hub.enqueue({agentId:'strategist',kind:'draft',prompt:'A first draft',requestId:'active-budget'});const work=f.hub.drain();await ready;assert.throws(()=>f.hub.saveProfile({...profile,currency:'EUR'}),/currency/i);assert.throws(()=>f.hub.saveProfile({...profile,apiBudgetCents:0,operatingBudgetCents:0,hardCapCents:0}),/reserved|committed|budget/i);f.hub.setPaused(true);await work;}finally{f.close();}
});
test('reference-free imports deduplicate normalized money amounts',()=>{
 const f=fixture();try{f.hub.saveProfile(profile);const csv=amount=>'date,kind,amount,category,description\n2026-10-17,income,'+amount+',sales,A sale';f.hub.importCsv(csv('25'));assert.equal(f.hub.importCsv(csv('25.00')).imported,0);assert.equal(f.hub.ledger().length,1);}finally{f.close();}
});
test('truncated model output settles known usage but never completes or populates the cache',async()=>{
 let calls=0;const f=fixture({fetchImpl:async()=>{calls++;return new Response(JSON.stringify({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[{content:[{type:'output_text',text:'A half finished'}]}],usage:{input_tokens:100,output_tokens:50}}));}});try{f.hub.saveProfile(profile);f.hub.saveProvider('openai',{key:'test',enabled:true});for(let i=0;i<2;i++){f.hub.enqueue({agentId:'strategist',kind:'draft',prompt:'Write a complete draft',requestId:'partial-'+i});await f.hub.drain();}assert.equal(calls,2);assert.equal(f.hub.jobs()[0].status,'failed');assert.match(f.hub.jobs()[0].error,/incomplete/i);assert.equal(f.hub.unknownUsage().length,0);assert.equal(f.hub.finance().apiSpendCents,2);}finally{f.close();}
});
test('concurrent jobs cannot race through the operating budget',async()=>{
 let calls=0;const f=fixture({fetchImpl:async()=>{calls++;return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'Draft'}]}],usage:{input_tokens:100,output_tokens:50}}));}});try{
  f.hub.saveProfile({...profile,apiBudgetCents:10,operatingBudgetCents:10,hardCapCents:10});f.hub.saveProvider('openai',{key:'test',enabled:true});
  f.hub.addLedger({date:new Date().toISOString().slice(0,10),kind:'expense',amountCents:9,category:'tools',description:'Already spent',source:'manual',externalId:'cost'});
  for(let i=0;i<3;i++)f.hub.enqueue({agentId:'strategist',kind:'draft',prompt:'Write a unique post '+i,requestId:'race-'+i});
  await Promise.all([f.hub.drain(),f.hub.drain(),f.hub.drain()]);assert.equal(calls,1);assert.equal(f.hub.finance().expenseCents,10);assert.equal(f.hub.jobs().filter(j=>j.status==='blocked').length,2);
 }finally{f.close();}
});
test('missing usage retains a reservation and can be reconciled exactly once after checking billing',async()=>{
 const f=fixture({fetchImpl:async()=>new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'No usage'}]}]}))});try{
  f.hub.saveProfile(profile);f.hub.saveProvider('openai',{key:'test',enabled:true});const job=f.hub.enqueue({agentId:'strategist',kind:'draft',prompt:'Create a draft',requestId:'unknown'});await f.hub.drain();
  assert.equal(f.hub.jobs()[0].status,'failed');assert.equal(f.hub.unknownUsage().length,1);
  f.hub.resolveUsage(job.id,{costCents:0,inputTokens:0,outputTokens:0,note:'Checked provider dashboard: request was not billed.'});
  assert.equal(f.hub.unknownUsage().length,0);assert.equal(f.hub.finance().usage[0].reservedCents,0);
  assert.throws(()=>f.hub.resolveUsage(job.id,{costCents:0,inputTokens:0,outputTokens:0,note:'Replay'}),/already/i);
 }finally{f.close();}
});
test('Anthropic cache input tokens are included in usage',async()=>{
 const result=await callProvider({provider:{id:'anthropic',model:'test',premiumModel:'test'},key:'test',system:'System',prompt:'Task',tier:1,fetchImpl:async()=>new Response(JSON.stringify({content:[{type:'text',text:'Answer'}],usage:{input_tokens:10,output_tokens:5,cache_creation_input_tokens:100,cache_read_input_tokens:200}}))});
 assert.equal(result.inputTokens,310);
});
test('month boundaries and losses do not produce negative tax reserves',()=>{
 const f=fixture();try{f.hub.saveProfile(profile);for(const [date,kind,amountCents,externalId] of [['2026-09-30','income',50000,'prev'],['2026-10-01','expense',1000,'loss']])f.hub.addLedger({date,kind,amountCents,category:'other',description:'Record',source:'manual',externalId});assert.equal(f.hub.finance('2026-10').revenueCents,0);assert.equal(f.hub.finance('2026-10').taxReserveCents,0);assert.equal(f.hub.finance('2026-09').revenueCents,50000);}finally{f.close();}
});
test('audit mutations are detected',()=>{const f=fixture();try{f.hub.saveProfile(profile);f.hub.store.db.prepare("UPDATE audit SET action='tampered' WHERE seq=1").run();assert.equal(f.hub.verifyAudit().valid,false);}finally{f.close();}});
test('resuming starts queued work without needing another enqueue',async()=>{
 const f=fixture();try{f.hub.saveProfile(profile);f.hub.enqueue({agentId:'manager',kind:'digest',prompt:'',requestId:'resume'});f.hub.setPaused(true);f.hub.setPaused(false);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.hub.jobs()[0].status,'completed');}finally{f.close();}
});
test('restart makes interrupted reservations available for owner reconciliation',()=>{
 const f=fixture();f.hub.saveProfile(profile);const job=f.hub.enqueue({agentId:'manager',kind:'brainstorm',prompt:'Plan a launch',requestId:'interrupted'});job.status='running';f.hub.store.db.prepare('UPDATE jobs SET status=?,data=? WHERE id=?').run('running',JSON.stringify(job),job.id);f.hub.store.db.prepare('INSERT INTO usage VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run('interrupted',job.id,'manager',new Date().toISOString().slice(0,7),0,0,0,10,2000,'reserved','openai',new Date().toISOString());f.hub.close();const next=createHub({dataDir:f.dataDir});try{assert.equal(next.jobs()[0].status,'failed');assert.equal(next.unknownUsage().length,1);next.resolveUsage(job.id,{costCents:0,inputTokens:0,outputTokens:0,note:'Not billed'});assert.equal(next.unknownUsage().length,0);}finally{next.close();}
});
test('business backup restores records and excludes private notes and keys',async()=>{
 const f=fixture();f.hub.saveProfile(profile);f.hub.personal.save({goals:'PRIVATE',notes:'SECRET',checkIn:'Weekly'});f.hub.saveProvider('openai',{key:'DO_NOT_EXPORT',enabled:true});
 const server=createApp(f.hub,{token:'test'}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const result=await fetch(`http://127.0.0.1:${server.address().port}/api/backup`,{headers:{authorization:'Bearer test'}});const data=await result.json();assert.ok(!JSON.stringify(data).includes('PRIVATE'));assert.ok(!JSON.stringify(data).includes('DO_NOT_EXPORT'));const file=join(f.dataDir,'restored.sqlite');writeFileSync(file,Buffer.from(data.business,'base64'));const restored=new DatabaseSync(file);assert.equal(JSON.parse(restored.prepare("SELECT data FROM documents WHERE key='profile'").get().data).name,'Alex');assert.equal(restored.prepare("SELECT name FROM sqlite_master WHERE name='personal'").get(),undefined);restored.close();}finally{await new Promise(r=>server.close(r));f.close();}
});
