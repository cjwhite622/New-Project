import {spawn} from 'node:child_process';
import {readdir,readFile,stat,writeFile} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {getMakeNsisPath} from 'app-builder-lib/out/toolsets/windows.js';
const root=resolve('.');
const {version}=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('The NSIS release version must contain three numeric components.');
async function run(binary,args,env=process.env){await new Promise((resolve,reject)=>{const child=spawn(binary,args,{stdio:'inherit',env});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Build command exited ${code}`)));});}
await run(process.execPath,['node_modules/electron-builder/out/cli/cli.js','--win','dir','--x64']);
const appDir=join(root,'release/win-unpacked');const files=[],dirs=[];
// Validate the configured Windows output rather than selecting a different
// unpacked directory (which could contain an old build or another platform).
for(const required of ['The Hub.exe',join('resources','app.asar')]){
  const file=join(appDir,required);
  let info;
  try{info=await stat(file);}catch(error){throw new Error(`Windows packaging requires ${file}. Check Electron Builder output.`,{cause:error});}
  if(!info.isFile()||info.size===0)throw new Error(`Windows application file is empty or invalid: ${file}`);
}
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory()){await walk(file);dirs.push(relative(appDir,file));}else if(entry.isFile())files.push(relative(appDir,file));else throw new Error('Unexpected symbolic link in Windows application.');}}
await walk(appDir);
const escape=value=>value.replaceAll('$','$$').replaceAll('"','$\\"').replaceAll('/','\\');
const manifest=join(root,'release/uninstall-manifest.nsh');
await writeFile(manifest,[...files.map(file=>`Delete "$INSTDIR\\${escape(file)}"`),...dirs.map(dir=>`RMDir "$INSTDIR\\${escape(dir)}"`)].join('\n')+'\n');
const nsis=await getMakeNsisPath();
await run(nsis.path,[`-DAPP_FILES=${join(appDir,'*')}`,`-DAPP_VERSION=${version}`,`-DOUTPUT_FILE=${join(root,`release/The Hub Setup ${version}.exe`)}`,`-DICON_FILE=${join(root,'build/icon.ico')}`,`-DUNINSTALL_MANIFEST=${manifest}`,join(root,'build/installer.nsi')],{...process.env,...nsis.env});
process.stdout.write('Windows installer built with native NSIS. Owner data is excluded from uninstall.\n');
