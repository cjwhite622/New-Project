import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import {fixture,profile} from './helpers.mjs';
import {createApp} from '../server/app.mjs';

const shop='green-days-fixture.myshopify.com';
const requests=[];let created=null;let loseWrite=false;
const f=fixture({fetchImpl:async(url,init)=>{
  const body=JSON.parse(init.body);requests.push({url,body});
  if(url.includes('.myshopify.com')){
    if(body.query.includes('pageCreate')){
      created={id:`gid://shopify/Page/${requests.filter(r=>r.body.query?.includes('pageCreate')).length}`, ...body.variables.page};
      if(loseWrite)throw new Error('Fixture response lost');
      return new Response(JSON.stringify({data:{pageCreate:{page:created,userErrors:[]}}}));
    }
    if(body.query.includes('pages('))return new Response(JSON.stringify({data:{pages:{nodes:created?[created]:[]}}}));
    return new Response(JSON.stringify({data:{shop:{id:'gid://shopify/Shop/8',name:'Green days fixture',myshopifyDomain:shop,currencyCode:'USD'},currentAppInstallation:{accessScopes:[{handle:'write_online_store_pages'}]}}}));
  }
  const text=body.input.includes('SHOPIFY_PAGE_PROPOSAL')?JSON.stringify({title:'Start your balcony herb garden',bodyText:'Practical gardening advice for a small balcony.\n\nA simple routine for your first herbs.'}):'Private launch materials for balcony gardeners.';
  return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text}]}],usage:{input_tokens:100,output_tokens:40}}));
}});
f.hub.saveProfile(profile);f.hub.saveProvider('openai',{enabled:true,key:'fixture-model-secret'});
f.hub.saveLaunchBrief({version:0,audience:'Balcony gardeners',transformation:'Grow herbs in a small space',format:'toolkit',channel:'text'});
f.hub.prepareLaunchDrafts({version:1,requestId:'fixture-pack'});await f.hub.drain();
const pack=f.hub.reviewLaunchPack({batchId:f.hub.launchState().batch.id});f.hub.decideApproval(pack.id,{version:1,decision:'approve'});
const server=createApp(f.hub,{token:'fixture-session'}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const writes=()=>requests.filter(r=>r.body.query?.includes('pageCreate'));
const models=()=>requests.filter(r=>r.url.includes('openai'));
const findings=report=>report.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
let browser,page;
try{
  browser=await chromium.launch({executablePath:process.env.HUB_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1050}});page=await context.newPage();await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/#session=fixture-session');await page.getByRole('button',{name:'Launch',exact:true}).click();
  await page.getByRole('button',{name:'Shopify settings',exact:false}).click();
  await page.getByLabel('Permanent Shopify domain').fill(shop);await page.getByLabel('App authentication').selectOption('token');await page.getByLabel('Admin API access token',{exact:true}).fill('fixture-shop-secret');
  await page.getByRole('button',{name:'Save Shopify connection',exact:true}).click();await page.getByRole('button',{name:'Check Shopify connection',exact:true}).click();await page.getByText('Checked · page access',{exact:true}).waitFor();
  assert.equal(writes().length,0);assert.equal(await page.getByLabel('Admin API access token',{exact:true}).inputValue(),'');
  const reports={};reports.connection=findings(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze());
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/shopify-connection.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});reports.connectionMobile=findings(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'test-results/shopify-connection-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1050});await page.getByRole('button',{name:'Launch',exact:true}).click();
  let deliveries=0;await page.route('**/api/shopify/page',async route=>{deliveries++;const response=await route.fetch();if(deliveries===1)await route.abort('failed');else await route.fulfill({response});});
  await page.getByRole('button',{name:'Prepare Shopify page preview',exact:true}).click();await page.getByRole('button',{name:'Retry page preview request',exact:true}).click();
  await page.getByRole('button',{name:'Prepare Shopify page preview',exact:true}).waitFor();await page.getByLabel('Shopify page title').waitFor();assert.equal(deliveries,2);assert.equal(models().length,4);
  await page.getByLabel('Shopify page title').fill('Your first balcony herbs');await page.getByLabel('Public page copy').fill('A useful <script>example</script> for balcony gardeners.\n\nBuild your own weekly routine.');await page.getByRole('button',{name:'Save page proposal',exact:true}).click();
  await page.getByRole('button',{name:'Review Shopify draft action',exact:true}).click();await page.getByRole('heading',{name:'Create unpublished Shopify page',exact:true}).waitFor();
  assert.ok((await page.locator('.approval-copy pre').textContent()).includes(shop));assert.equal(await page.getByRole('button',{name:'Edit draft',exact:true}).count(),0);assert.equal(writes().length,0);
  await page.getByRole('button',{name:'Approve',exact:true}).click();await page.getByRole('button',{name:/^Decided/}).click();await page.getByText('Unpublished Shopify page created. Store:',{exact:false}).waitFor();
  assert.equal(writes().length,1);assert.equal(writes()[0].body.variables.page.isPublished,false);assert.match(writes()[0].body.variables.page.body,/&lt;script&gt;/);
  await page.getByRole('button',{name:'Launch',exact:true}).click();await page.getByText('Unpublished Shopify page created.',{exact:true}).waitFor();
  reports.preview=findings(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze());await page.screenshot({path:'test-results/shopify-page.png',fullPage:true});
  await page.reload();await page.getByRole('button',{name:'Launch',exact:true}).click();await page.getByText('Unpublished Shopify page created.',{exact:true}).waitFor();assert.equal(await page.getByLabel('Shopify page title').inputValue(),'Your first balcony herbs');
  // Keep an older review while a newer private proposal is visible. Its unknown action must remain recoverable.
  await page.getByRole('button',{name:'Prepare Shopify page preview',exact:true}).click();await page.getByLabel('Shopify page title').filter({visible:true}).waitFor();
  await page.getByRole('button',{name:'Review Shopify draft action',exact:true}).click();
  const second=f.hub.shopifyState().proposal;loseWrite=true;
  await page.getByRole('button',{name:'Launch',exact:true}).click();await page.getByRole('button',{name:'Prepare Shopify page preview',exact:true}).click();
  await page.getByRole('button',{name:'Review Shopify draft action',exact:true}).waitFor();assert.notEqual(f.hub.shopifyState().proposal.id,second.id);
  await page.getByRole('button',{name:'Approvals',exact:false}).first().click();await page.getByRole('button',{name:'Approve',exact:true}).click();
  await page.getByRole('button',{name:'Launch',exact:true}).click();await page.getByRole('heading',{name:'A Shopify request needs a result check.',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Prepare Shopify page preview',exact:true}).isDisabled(),true);assert.equal(writes().length,2);
  await page.setViewportSize({width:390,height:844});reports.recoveryMobile=findings(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'test-results/shopify-recovery-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Check Shopify result',exact:true}).click();await page.getByRole('heading',{name:'A Shopify request needs a result check.',exact:true}).waitFor({state:'hidden'});assert.equal(writes().length,2);assert.equal(f.hub.approvals().find(a=>a.id===second.approvalId).execution,'draft_created');
  await writeFile('test-results/shopify-accessibility.json',JSON.stringify(reports,null,2));for(const [name,violations] of Object.entries(reports))assert.deepEqual(violations,[],name);
  assert.deepEqual(errors,[]);assert.doesNotMatch(await page.content(),/fixture-shop-secret|fixture-model-secret/);assert.doesNotMatch(await page.evaluate(()=>JSON.stringify({...localStorage})),/fixture-shop-secret|fixture-model-secret/);
  process.stdout.write('Shopify workflow passed: explicit connection, private preview, lost-response replay, exact edited approval, one unpublished write, durable receipt, older held-action recovery, secret exclusion, accessibility and mobile layout. Controlled responses only.\n');
}catch(error){if(page)await page.screenshot({path:'test-results/shopify-failure.png',fullPage:true});throw error;
}finally{if(browser)await browser.close();await f.hub.drain();await new Promise(resolve=>server.close(resolve));f.close();}
