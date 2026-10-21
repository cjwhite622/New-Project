import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,profile} from './helpers.mjs';
import {createHub} from '../server/hub.mjs';

const shop='green-days-fixture.myshopify.com';
const direction={audience:'Balcony gardeners',transformation:'Grow herbs in a small space',format:'toolkit',channel:'text'};
const page={title:'A balcony herb starter kit',bodyText:'Practical steps for your first herbs.\n\nJoin the launch list.'};
const complete=text=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text}]}],usage:{input_tokens:100,output_tokens:50}}));
function scenario(options={}){
  const requests=[];let created=null;let tokens=0;
  const f=fixture({fetchImpl:async(url,init)=>{
    const body=JSON.parse(init.body);requests.push({url,body,headers:init.headers,redirect:init.redirect});
    if(url.endsWith('/admin/oauth/access_token')){tokens++;if(options.token)await options.token(tokens);return new Response(JSON.stringify({access_token:'fixture-issued-token-'+tokens,expires_in:options.expired?1:86400}));}
    if(url.includes('.myshopify.com')){
      if(body.query.includes('pageCreate')){
        created={id:'gid://shopify/Page/42',...body.variables.page};
        if(options.write) return options.write({url,init,body,created});
        return new Response(JSON.stringify({data:{pageCreate:{page:created,userErrors:[]}}}));
      }
      if(body.query.includes('pages('))return new Response(JSON.stringify({data:{pages:{nodes:options.notFound?[]:created?[created]:[]}}}));
      if(body.query.includes('node(id:'))return new Response(JSON.stringify({data:{node:created}}));
      return new Response(JSON.stringify({data:{shop:{id:'gid://shopify/Shop/8',name:'Green days fixture',myshopifyDomain:shop,currencyCode:'USD'},currentAppInstallation:{accessScopes:(options.scopes??['write_online_store_pages']).map(handle=>({handle}))}}}));
    }
    const prompt=body.input??'';
    return complete(prompt.includes('SHOPIFY_PAGE_PROPOSAL')?(options.invalid?'Not valid JSON':JSON.stringify(options.page??page)):'Private launch material.');
  }});
  f.hub.saveProfile(profile);f.hub.saveProvider('openai',{enabled:true,key:'fixture-model-secret'});
  return {...f,requests,writeCalls:()=>requests.filter(r=>r.body.query?.includes('pageCreate')),modelCalls:()=>requests.filter(r=>r.url.includes('openai')),tokens:()=>tokens};
}
async function approvedPack(f){f.hub.saveLaunchBrief({version:0,...direction});f.hub.prepareLaunchDrafts({version:1,requestId:'pack'});await f.hub.drain();const batch=f.hub.launchState().batch;const a=f.hub.reviewLaunchPack({batchId:batch.id});f.hub.decideApproval(a.id,{version:1,decision:'approve'});return batch;}
async function connection(f,mode='token'){f.hub.saveShopifyConnection(mode==='token'?{shop,mode,token:'fixture-shop-secret'}:{shop,mode,clientId:'fixture-client-id',clientSecret:'fixture-client-secret'});await f.hub.checkShopifyConnection();}
async function proposed(f){const batch=await approvedPack(f);await connection(f);f.hub.prepareShopifyPage({batchId:batch.id,requestId:'page'});await f.hub.drain();return f.hub.shopifyState().proposal;}

test('Shopify is an explicit owner connection with a fixed shop endpoint and no secrets in state or backup data',async()=>{
  const f=scenario();try{
    assert.equal(typeof f.hub.saveShopifyConnection,'function','The Shopify connection adapter is not implemented');
    for(const value of ['https://'+shop,'127.0.0.1','bad.myshopify.com.evil.example','store.myshopify.com/path'])assert.throws(()=>f.hub.saveShopifyConnection({shop:value,mode:'token',token:'fixture-shop-secret'}));
    await connection(f);const state=f.hub.shopifyState();assert.equal(state.connection.shop,shop);assert.ok(state.connection.verifiedAt);
    assert.equal(f.requests.length,1);assert.equal(f.requests[0].redirect,'error');assert.equal(f.requests[0].url,`https://${shop}/admin/api/2026-10/graphql.json`);
    assert.doesNotMatch(JSON.stringify(f.hub.state()),/fixture-shop-secret|fixture-model-secret/);
    assert.doesNotMatch(JSON.stringify(f.hub.store.db.prepare('SELECT data FROM documents').all()),/fixture-shop-secret/);
  }finally{f.close();}
});

test('client credentials renew expiring tokens without exposing them to model prompts',async()=>{
  const f=scenario({expired:true});try{
    await connection(f,'client_credentials');await f.hub.checkShopifyConnection();assert.equal(f.tokens(),2);
    const auth=f.requests.find(r=>r.url.endsWith('/admin/oauth/access_token'));assert.equal(auth.body.grant_type,'client_credentials');assert.equal(auth.body.client_id,'fixture-client-id');
    assert.doesNotMatch(JSON.stringify(f.hub.state()),/fixture-client-secret|fixture-issued-token/);
  }finally{f.close();}
});

test('an approved launch pack produces a private validated page and one exact action review before any Shopify write',async()=>{
  const f=scenario({page:{...page,bodyText:'A useful <script>alert(1)</script> example.'}});try{
    const p=await proposed(f);assert.equal(p.job.status,'completed');assert.equal(p.draft.title,page.title);assert.equal(f.writeCalls().length,0);
    const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});const replay=f.hub.reviewShopifyPage({id:p.id,version:p.version});assert.equal(a.id,replay.id);
    assert.ok(a.content.includes(shop));assert.ok(a.content.includes('<script>'));assert.equal(f.writeCalls().length,0);
    assert.throws(()=>f.hub.editApproval(a.id,{version:1,content:'Changed text'}),/Launch|protected|page proposal/i);
    f.hub.decideApproval(a.id,{version:1,decision:'approve'});await f.hub.drain();assert.equal(f.writeCalls().length,1);
    const sent=f.writeCalls()[0].body.variables.page;assert.equal(sent.isPublished,false);assert.match(sent.body,/&lt;script&gt;/);assert.doesNotMatch(sent.body,/<script>/);
    const result=f.hub.approvals().find(r=>r.id===a.id);assert.equal(result.execution,'draft_created');assert.equal(result.receipt.id,'gid://shopify/Page/42');
    assert.throws(()=>f.hub.decideApproval(a.id,{version:1,decision:'approve'}),/already/i);assert.equal(f.writeCalls().length,1);
    assert.doesNotMatch(JSON.stringify(f.modelCalls()),/fixture-shop-secret/);
  }finally{f.close();}
});

test('unapproved or changed source material blocks page preparation and queued extraction without additional model usage',async()=>{
  const f=scenario();try{
    const batch=await approvedPack(f);const approval=f.hub.approvals().find(a=>a.id===batch.approvalId)||f.hub.approvals()[0];
    f.hub.editApproval(approval.id,{version:1,content:'Revised private pack.'});assert.throws(()=>f.hub.prepareShopifyPage({batchId:batch.id,requestId:'unreviewed'}),/approved|review/i);
    f.hub.decideApproval(approval.id,{version:2,decision:'approve'});f.hub.prepareShopifyPage({batchId:batch.id,requestId:'stale'});
    f.hub.saveProfile({...profile,weeklyHours:1});await f.hub.drain();assert.equal(f.modelCalls().length,3);assert.equal(f.hub.shopifyState().proposal.job.status,'blocked');
  }finally{f.close();}
});

test('malformed page output settles known usage and is never a completed cached page',async()=>{
  const f=scenario({invalid:true});try{
    const p=await proposed(f);assert.equal(p.job.status,'failed');assert.equal(f.hub.unknownUsage().length,0);assert.equal(f.hub.finance().apiSpendCents,4);
    assert.throws(()=>f.hub.reviewShopifyPage({id:p.id,version:p.version}),/complete|valid/i);assert.equal(f.writeCalls().length,0);
  }finally{f.close();}
});

test('source edits, changed connection settings, denied review and pause prevent a store write',async()=>{
  for(const change of ['source','connection','deny','pause','veto','disabled']){
    const f=scenario();try{
      const p=await proposed(f);const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});
      if(change==='deny'){f.hub.decideApproval(a.id,{version:1,decision:'deny'});await f.hub.drain();}
      else{
        f.hub.decideApproval(a.id,{version:1,decision:'approve'});
        if(change==='source'){const source=f.hub.launchState().batch.approvalId;f.hub.editApproval(source,{version:1,content:'Changed source'});}
        if(change==='connection')f.hub.saveShopifyConnection({shop,mode:'token',token:'replacement-fixture-token'});
        if(change==='pause')f.hub.setPaused(true);
        if(change==='veto')f.hub.veto(a.id);
        if(change==='disabled')f.hub.saveAgent('publishing',{tokenBudget:100000,enabled:false});
        await f.hub.drain();
      }
      assert.equal(f.writeCalls().length,0,change);
    }finally{f.close();}
  }
});

test('lost mutation responses remain held and read-only reconciliation finds the exact unpublished page without retry',async()=>{
  const f=scenario({write:()=>{throw new Error('Connection lost with PRIVATE_PROVIDER_RESPONSE');}});try{
    const p=await proposed(f);const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});f.hub.decideApproval(a.id,{version:1,decision:'approve'});await f.hub.drain();
    assert.equal(f.hub.approvals().find(r=>r.id===a.id).execution,'unknown');assert.equal(f.writeCalls().length,1);
    assert.throws(()=>f.hub.resolveShopifyPageReview({approvalId:a.id,note:'Cannot resolve an unknown attempt as a known page.'}),/known|receipt/i);
    assert.throws(()=>f.hub.prepareShopifyPage({batchId:f.hub.launchState().batch.id,requestId:'bypass-hold'}),/unknown|reconcile|held/i);
    const result=await f.hub.reconcileShopifyPage({approvalId:a.id});assert.equal(result.execution,'draft_created');assert.equal(f.writeCalls().length,1);
    assert.doesNotMatch(JSON.stringify(f.hub.state()),/PRIVATE_PROVIDER_RESPONSE/);
  }finally{f.close();}
});

test('empty reconciliation results keep the hold until an explicit owner-reported non-creation confirmation',async()=>{
  const f=scenario({notFound:true,write:()=>{throw new Error('Lost response');}});try{
    const p=await proposed(f);const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});f.hub.decideApproval(a.id,{version:1,decision:'approve'});await f.hub.drain();
    await f.hub.reconcileShopifyPage({approvalId:a.id});assert.equal(f.hub.approvals().find(r=>r.id===a.id).execution,'unknown');
    f.hub.confirmShopifyNotCreated({approvalId:a.id,note:'Fixture account check confirms no page was created.'});
    assert.equal(f.hub.approvals().find(r=>r.id===a.id).execution,'owner_confirmed_not_created');assert.equal(f.writeCalls().length,1);
    const next=f.hub.reviewShopifyPage({id:p.id,version:p.version});assert.notEqual(next.id,a.id);assert.equal(next.status,'pending');assert.equal(f.writeCalls().length,1);
  }finally{f.close();}
});

test('Shopify rejects missing write scope before an action is queued',async()=>{
  const f=scenario({scopes:['read_content']});try{
    const p=await proposed(f);assert.throws(()=>f.hub.reviewShopifyPage({id:p.id,version:p.version}),/scope|permission/i);assert.equal(f.writeCalls().length,0);
  }finally{f.close();}
});

test('page edits supersede an unexecuted action and require a new exact review',async()=>{
  const f=scenario();try{
    const p=await proposed(f);const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});
    const edited=f.hub.saveShopifyPage({id:p.id,version:p.version,title:'Revised herb page',bodyText:'Revised public copy.'});assert.equal(edited.version,p.version+1);
    assert.throws(()=>f.hub.decideApproval(a.id,{version:1,decision:'approve'}),/changed|superseded|already/i);
    const next=f.hub.reviewShopifyPage({id:p.id,version:edited.version});f.hub.decideApproval(next.id,{version:1,decision:'approve'});await f.hub.drain();
    assert.equal(f.writeCalls()[0].body.variables.page.title,'Revised herb page');assert.equal(f.writeCalls().length,1);
  }finally{f.close();}
});

test('a rejected page action can receive a new review without silently retrying the original write',async()=>{
  const f=scenario({write:()=>new Response(JSON.stringify({data:{pageCreate:{page:null,userErrors:[{code:'INVALID',message:'PRIVATE_ERROR'}]}}}))});try{
    const p=await proposed(f);const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});f.hub.decideApproval(a.id,{version:1,decision:'approve'});await f.hub.drain();
    assert.equal(f.hub.approvals().find(r=>r.id===a.id).execution,'rejected');
    const next=f.hub.reviewShopifyPage({id:p.id,version:p.version});assert.notEqual(next.id,a.id);assert.equal(next.status,'pending');assert.equal(f.writeCalls().length,1);
  }finally{f.close();}
});

test('read-only replacement credentials can reconcile an uncertain page creation',async()=>{
  const f=scenario({write:()=>{throw new Error('Lost response');}});try{
    const p=await proposed(f);const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});f.hub.decideApproval(a.id,{version:1,decision:'approve'});await f.hub.drain();
    f.hub.saveShopifyConnection({shop,mode:'token',token:'replacement-read-only-secret'});await f.hub.checkShopifyConnection();
    const c=f.hub.store.get('shopify:connection');f.hub.store.set('shopify:connection',{...c,scopes:['read_content']});
    const result=await f.hub.reconcileShopifyPage({approvalId:a.id});assert.equal(result.execution,'draft_created');assert.equal(f.writeCalls().length,1);
  }finally{f.close();}
});

test('restart distinguishes a dispatched unknown action from an interrupted preflight that did not dispatch',async()=>{
  for(const dispatched of [true,false]){
    const f=scenario();let again;try{
      const p=await proposed(f);const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});f.hub.decideApproval(a.id,{version:1,decision:'approve'});
      const task=f.hub.jobs().find(j=>j.workflow?.type==='shopify-action');task.status='running';f.hub.store.db.prepare('UPDATE jobs SET status=?,data=? WHERE id=?').run('running',JSON.stringify(task),task.id);
      if(dispatched){const card=f.hub.approvals().find(r=>r.id===a.id);card.execution='creating';f.hub.store.db.prepare('UPDATE approvals SET data=? WHERE id=?').run(JSON.stringify(card),card.id);}
      again=createHub({dataDir:f.dataDir});const recovered=again.approvals().find(r=>r.id===a.id);assert.equal(recovered.execution,dispatched?'unknown':'blocked');
      assert.equal(f.writeCalls().length,0);
    }finally{again?.close();f.close();}
  }
});

test('veto never replaces an unknown or already-created store action with another write',async()=>{
  for(const lost of [true,false]){
    const f=scenario(lost?{write:()=>{throw new Error('Lost response');}}:{});try{
      const p=await proposed(f);const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});f.hub.decideApproval(a.id,{version:1,decision:'approve'});await f.hub.drain();
      f.hub.veto(a.id);const next=f.hub.reviewShopifyPage({id:p.id,version:p.version});
      assert.equal(next.id,a.id);assert.equal(next.execution,lost?'unknown':'draft_created');assert.equal(f.writeCalls().length,1);
    }finally{f.close();}
  }
});

test('an older held action stays recoverable and prevents dispatch of a previously prepared second page',async()=>{
  const f=scenario({write:()=>{throw new Error('Lost response');}});try{
    const p1=await proposed(f);const a1=f.hub.reviewShopifyPage({id:p1.id,version:p1.version});
    f.hub.prepareShopifyPage({batchId:f.hub.launchState().batch.id,requestId:'second-page'});await f.hub.drain();
    const p2=f.hub.shopifyState().proposal;const a2=f.hub.reviewShopifyPage({id:p2.id,version:p2.version});
    f.hub.decideApproval(a1.id,{version:1,decision:'approve'});await f.hub.drain();
    assert.equal(f.hub.shopifyState().proposal.id,p2.id);
    assert.ok(f.hub.shopifyState().heldActions.some(a=>a.id===a1.id&&a.execution==='unknown'));
    assert.throws(()=>f.hub.decideApproval(a2.id,{version:1,decision:'approve'}),/held|unknown|reconcile/i);
    assert.equal(f.hub.approvals().find(a=>a.id===a2.id).status,'pending');await f.hub.drain();assert.equal(f.writeCalls().length,1);
    assert.equal((await f.hub.reconcileShopifyPage({approvalId:a1.id})).execution,'draft_created');
  }finally{f.close();}
});

test('preflight blocks clear queued actions so a replacement exact review can recover without another model call',async()=>{
  for(const change of ['connection','source','disabled']){
    const f=scenario();try{
      const p=await proposed(f);const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});f.hub.decideApproval(a.id,{version:1,decision:'approve'});
      if(change==='connection')f.hub.saveShopifyConnection({shop,mode:'token',token:'replacement-fixture-token'});
      if(change==='source')f.hub.saveProfile({...profile,weeklyHours:1});
      if(change==='disabled')f.hub.saveAgent('publishing',{tokenBudget:100000,enabled:false});
      await f.hub.drain();assert.equal(f.writeCalls().length,0);
      assert.equal(f.hub.approvals().find(row=>row.id===a.id).execution,'blocked',change);assert.equal(f.hub.shopifyState().heldActions.length,0);
      if(change==='connection'){
        await f.hub.checkShopifyConnection();const next=f.hub.reviewShopifyPage({id:p.id,version:p.version});assert.notEqual(next.id,a.id);
        f.hub.decideApproval(next.id,{version:1,decision:'approve'});await f.hub.drain();assert.equal(f.writeCalls().length,1);assert.equal(f.modelCalls().length,4);
      }
    }finally{f.close();}
  }
});

test('explicit review refresh replaces a stale pending connection review without a new model request',async()=>{
  const f=scenario();try{
    const p=await proposed(f);const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});
    f.hub.saveShopifyConnection({shop,mode:'token',token:'rotated-fixture-token'});await f.hub.checkShopifyConnection();
    assert.equal(f.hub.shopifyState().proposal.reviewOutdated,true);
    const next=f.hub.reviewShopifyPage({id:p.id,version:p.version});assert.notEqual(next.id,a.id);assert.equal(f.hub.approvals().find(row=>row.id===a.id).status,'superseded');
    assert.throws(()=>f.hub.decideApproval(a.id,{version:1,decision:'approve'}),/changed|already|superseded/i);
    f.hub.decideApproval(next.id,{version:1,decision:'approve'});await f.hub.drain();assert.equal(f.writeCalls().length,1);assert.equal(f.modelCalls().length,4);
  }finally{f.close();}
});

test('a returned page that differs from the reviewed copy requires an explicit receipt resolution and cannot replay',async()=>{
  const f=scenario({write:({created})=>new Response(JSON.stringify({data:{pageCreate:{page:{...created,body:'Shopify normalized copy.'},userErrors:[]}}}))});try{
    const p=await proposed(f);const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});f.hub.decideApproval(a.id,{version:1,decision:'approve'});await f.hub.drain();
    assert.equal(f.hub.approvals().find(row=>row.id===a.id).execution,'review_required');assert.equal(f.hub.shopifyState().heldActions.length,1);
    const resolved=f.hub.resolveShopifyPageReview({approvalId:a.id,note:'Checked the returned page in the fixture store; accept its copy and unpublished visibility.'});
    assert.equal(resolved.execution,'owner_reviewed');assert.equal(f.hub.shopifyState().heldActions.length,0);
    f.hub.veto(a.id);assert.equal(f.hub.reviewShopifyPage({id:p.id,version:p.version}).id,a.id);assert.equal(f.writeCalls().length,1);
  }finally{f.close();}
});

test('revocation during token renewal prevents the page mutation at the actual transport boundary',async()=>{
  for(const change of ['veto','source','disabled']){
    let release,ready;const gate=new Promise(resolve=>{release=resolve;});const renewing=new Promise(resolve=>{ready=resolve;});
    const f=scenario({expired:true,token:async count=>{if(count===3){ready();await gate;}}});try{
      const batch=await approvedPack(f);await connection(f,'client_credentials');f.hub.prepareShopifyPage({batchId:batch.id,requestId:'page'});await f.hub.drain();
      const p=f.hub.shopifyState().proposal;const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});f.hub.decideApproval(a.id,{version:1,decision:'approve'});
      const running=f.hub.drain();await renewing;assert.equal(f.writeCalls().length,0);
      if(change==='veto')f.hub.veto(a.id);if(change==='source')f.hub.saveProfile({...profile,weeklyHours:1});if(change==='disabled')f.hub.saveAgent('publishing',{tokenBudget:100000,enabled:false});
      release();await running;assert.equal(f.writeCalls().length,0,change);assert.equal(f.hub.shopifyState().heldActions.length,0);
    }finally{release();await f.hub.drain();f.close();}
  }
});

test('a known mismatched receipt can be rechecked by its saved page ID without another write',async()=>{
  const f=scenario({write:({created})=>new Response(JSON.stringify({data:{pageCreate:{page:{...created,body:'Changed remote body.'},userErrors:[]}}}))});try{
    const p=await proposed(f);const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});f.hub.decideApproval(a.id,{version:1,decision:'approve'});await f.hub.drain();
    assert.equal(f.hub.approvals().find(row=>row.id===a.id).execution,'review_required');
    const checked=await f.hub.reconcileShopifyPage({approvalId:a.id});assert.equal(checked.execution,'draft_created');assert.equal(f.writeCalls().length,1);
    assert.deepEqual(f.requests.at(-1).body.variables,{id:'gid://shopify/Page/42'});
  }finally{f.close();}
});

test('pausing an in-flight Shopify write retains an unknown hold and resuming cannot retry it',async()=>{
  let started;const dispatched=new Promise(resolve=>{started=resolve;});
  const f=scenario({write:({init})=>new Promise((resolve,reject)=>{started();init.signal.addEventListener('abort',()=>reject(new Error('Fixture abort')),{once:true});})});try{
    const p=await proposed(f);const a=f.hub.reviewShopifyPage({id:p.id,version:p.version});f.hub.decideApproval(a.id,{version:1,decision:'approve'});
    const running=f.hub.drain();await dispatched;f.hub.setPaused(true);await running;assert.equal(f.hub.approvals().find(row=>row.id===a.id).execution,'unknown');
    f.hub.setPaused(false);await f.hub.drain();assert.equal(f.writeCalls().length,1);assert.equal(f.hub.unknownUsage().length,0);
  }finally{f.close();}
});
