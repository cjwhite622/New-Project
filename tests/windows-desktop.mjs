import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {_electron as electron} from 'playwright-core';

// Windows shell folders do not follow XDG isolation. Only a disposable hosted
// runner may use this harness, and an existing Hub profile is never overwritten.
if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_ENVIRONMENT!=='github-hosted'||!process.env.APPDATA){
  throw new Error('This test requires a disposable GitHub-hosted Windows runner.');
}
const profile=join(process.env.APPDATA,'The Hub');
await mkdir(profile); // Abort if a profile already exists.
const ownership=join(profile,'.windows-smoke-owner');
const marker=randomUUID();
await writeFile(ownership,marker);
const executable=process.env.HUB_DESKTOP_EXECUTABLE;
const kind=executable?'packaged':'source';
let application;
try{
  application=await electron.launch({
    ...(executable?{executablePath:resolve(executable)}:{}),
    args:executable?[]:['.'],
    timeout:45000,
  });
  const window=await application.firstWindow({timeout:45000});
  await window.getByLabel('Your name or nickname').waitFor({timeout:45000});
  assert.equal(await window.evaluate(()=>typeof window.require),'undefined');
  await window.getByLabel('Your name or nickname').fill('Windows test owner');
  await window.getByRole('button',{name:'Continue',exact:true}).click();
  await window.getByRole('heading',{name:'Good to meet you, Windows test owner. Where are you starting?'}).waitFor();
  await window.reload();
  await window.getByRole('heading',{name:'Good to meet you, Windows test owner. Where are you starting?'}).waitFor();
  const startup=await readFile(join(profile,'diagnostics','desktop-startup.log'),'utf8');
  assert.ok(startup.trim().split('\n').map(line=>JSON.parse(line)).some(entry=>entry.stage==='window-loaded'&&entry.platform==='win32'));
  assert.doesNotMatch(startup,/session=|http:\/\/|Bearer |Windows test owner/);
  await mkdir('test-results',{recursive:true});
  await window.screenshot({path:`test-results/windows-${kind}.png`});
  await writeFile(`test-results/windows-${kind}-startup.log`,startup);
  process.stdout.write(`${kind} Windows GUI, interview persistence, local API and renderer isolation passed.\n`);
}finally{
  await mkdir('test-results',{recursive:true});
  try{await writeFile(`test-results/windows-${kind}-startup.log`,await readFile(join(profile,'diagnostics','desktop-startup.log')));}catch{}
  if(application){
    const timeout=setTimeout(()=>application.process().kill(),10000);
    try{await application.close();}finally{clearTimeout(timeout);}
  }
  if(await readFile(ownership,'utf8')===marker)await rm(profile,{recursive:true,force:true});
}
