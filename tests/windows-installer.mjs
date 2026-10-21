import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {access,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

// Installation changes the current account's shell folders and registry. Never
// run this test on a developer's PC or reuse an existing installation/profile.
if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_ENVIRONMENT!=='github-hosted'||!process.env.APPDATA||!process.env.LOCALAPPDATA){
  throw new Error('This test requires a disposable GitHub-hosted Windows runner.');
}
async function exists(path){try{await access(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
async function run(binary,args,env=process.env){
  await new Promise((resolve,reject)=>{
    const child=spawn(binary,args,{stdio:'inherit',env});
    const timeout=setTimeout(()=>{child.kill();reject(new Error('Windows installer check timed out.'));},120000);
    child.once('error',error=>{clearTimeout(timeout);reject(error);});
    child.once('exit',(code,signal)=>{
      clearTimeout(timeout);
      if(code===0)resolve();else reject(new Error(`Windows installer command exited ${code??signal}.`));
    });
  });
}
async function digest(path){
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(path))hash.update(chunk);
  return hash.digest('hex');
}
const {version}=JSON.parse(await readFile('package.json','utf8'));
const installer=resolve(`release/The Hub Setup ${version}.exe`);
const installation=join(process.env.LOCALAPPDATA,'Programs','The Hub');
const profile=join(process.env.APPDATA,'The Hub');
assert.equal(await exists(installation),false,'Refusing to replace an existing installation.');
assert.equal(await exists(profile),false,'Refusing to use an existing owner profile.');
const evidence={version,platform:process.platform,install:false,installedLaunch:false,reinstall:false,uninstall:false,workspacePreserved:false};
const appFiles=['The Hub.exe',join('resources','app.asar')];
const databases=['business.sqlite','personal.sqlite'].map(file=>join(profile,'workspace',file));
const ownership=join(profile,'.windows-smoke-owner');
let marker;
try{
  await run(installer,['/S']);
  for(const file of appFiles)assert.equal(await digest(join(installation,file)),await digest(join('release','win-unpacked',file)));
  evidence.install=true;
  await run(process.execPath,['tests/windows-desktop.mjs'],{
    ...process.env,HUB_DESKTOP_EXECUTABLE:join(installation,'The Hub.exe'),
    HUB_CI_DESKTOP_KIND:'installed',HUB_CI_KEEP_PROFILE:'true',
  });
  marker=await readFile(ownership,'utf8');
  assert.match(marker,/^[0-9a-f-]{36}$/);
  evidence.installedLaunch=true;
  const saved=await Promise.all(databases.map(digest));

  await run(installer,['/S']);
  for(const file of appFiles)assert.equal(await digest(join(installation,file)),await digest(join('release','win-unpacked',file)));
  assert.deepEqual(await Promise.all(databases.map(digest)),saved,'Reinstall modified the saved workspace.');
  evidence.reinstall=true;

  await run(join(installation,'Uninstall.exe'),['/S']);
  // NSIS starts a temporary uninstaller process to remove its own executable.
  const deadline=Date.now()+15000;
  while(await exists(installation)&&Date.now()<deadline)await delay(250);
  assert.equal(await exists(installation),false,'Uninstall left application files behind.');
  evidence.uninstall=true;
  assert.equal(await readFile(ownership,'utf8'),marker);
  assert.deepEqual(await Promise.all(databases.map(digest)),saved,'Uninstall modified the saved workspace.');
  evidence.workspacePreserved=true;
  process.stdout.write('Windows silent install, installed GUI, reinstall and uninstall passed; both workspace databases preserved.\n');
}finally{
  await mkdir('test-results',{recursive:true});
  await writeFile('test-results/windows-installer.json',JSON.stringify(evidence,null,2)+'\n');
  if(marker&&await readFile(ownership,'utf8')===marker)await rm(profile,{recursive:true,force:true});
}
