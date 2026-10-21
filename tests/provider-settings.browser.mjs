import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import {fixture,profile} from './helpers.mjs';
import {createApp} from '../server/app.mjs';

const requests=[];
const f=fixture({fetchImpl:async(url,options)=>{
  requests.push({url,body:options.body?JSON.parse(options.body):undefined});
  if(url.endsWith('/models'))return new Response(JSON.stringify({data:[{id:'kimi-k2.6'},{id:'kimi-k3'}]}));
  if(JSON.parse(options.body).model==='kimi-k2.5')return new Response(JSON.stringify({error:{type:'resource_not_found_error',message:'Model not found.'}}),{status:404});
  return new Response(JSON.stringify({choices:[{message:{content:'First action: validate the offer with three prospective customers.'},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:20}}));
}});
f.hub.saveProfile(profile);
f.hub.saveProvider('moonshot',{enabled:true,key:'fixture-provider-secret',model:'kimi-k2.5',premiumModel:'kimi-k2.5',inputPerMillion:.6,outputPerMillion:3,premiumInputPerMillion:.6,premiumOutputPerMillion:3});
const server=createApp(f.hub,{token:'fixture-session'}).listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.HUB_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/#session=fixture-session');
  async function task(prompt,status){
    await page.getByRole('button',{name:'Overview',exact:true}).click();
    await page.getByRole('button',{name:'Ask your Manager',exact:true}).click();
    await page.getByLabel('Give your team some context').fill(prompt);
    await page.getByRole('button',{name:'Give task to team'}).click();
    const row=page.getByRole('button',{name:new RegExp(prompt)});
    await row.getByText(status,{exact:true}).waitFor();
    await row.click();
  }
  await task('Plan with retired Kimi','failed');
  await page.getByRole('dialog').getByText(/cost reservation was released/).waitFor();
  assert.equal(f.hub.unknownUsage().length,0);assert.equal(requests.length,1);
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  const card=page.locator('section.provider-card').filter({has:page.getByRole('heading',{name:'Kimi / Moonshot',exact:true})});
  await card.getByText('Kimi K2.5 was discontinued.',{exact:false}).waitFor();
  await card.getByRole('button',{name:'Check available models'}).click();
  await card.getByText('2 models returned.',{exact:false}).waitFor();
  assert.equal(await card.getByLabel('Routine model',{exact:true}).inputValue(),'kimi-k2.5');
  assert.ok(!(f.hub.providers().find(p=>p.id==='moonshot').verifiedAt));
  assert.ok(requests[1].url.endsWith('/models'));assert.equal(requests[1].body,undefined);
  await card.getByRole('button',{name:'Use Kimi K2.6'}).click();
  assert.equal(await card.getByLabel('Routine model',{exact:true}).inputValue(),'kimi-k2.6');
  assert.equal(await card.getByLabel('Premium model',{exact:true}).inputValue(),'kimi-k2.6');
  assert.equal(await card.getByLabel('Routine input · $ / 1M',{exact:true}).inputValue(),'0.95');
  assert.equal(await card.getByLabel('Premium output · $ / 1M',{exact:true}).inputValue(),'4');
  assert.equal(f.hub.providers().find(p=>p.id==='moonshot').model,'kimi-k2.5');
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
  assert.deepEqual(accessibility.violations.map(v=>v.id),[]);
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/provider-models.png',fullPage:true});
  const saved=page.waitForResponse(response=>response.url()===base+'/api/providers/moonshot'&&response.request().method()==='POST');
  await card.getByRole('button',{name:'Save provider',exact:true}).click();
  assert.equal((await saved).status(),200);
  await task('Plan with current Kimi','completed');
  await page.getByRole('dialog').getByText(/validate the offer/).waitFor();
  assert.ok(f.hub.providers().find(p=>p.id==='moonshot').verifiedAt);
  assert.equal(requests.filter(request=>request.url.endsWith('/chat/completions')).length,2);
  assert.equal(requests.at(-1).body.model,'kimi-k2.6');
  assert.equal(f.hub.unknownUsage().length,0);
  assert.ok(!(await page.content()).includes('fixture-provider-secret'));
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  process.stdout.write('Kimi settings recovery passed: structured 404, model lookup, explicit model/rate change, successful draft, provider verification, accessibility and mobile layout. Controlled responses only; no provider account or paid request used.\n');
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));f.close();
}
