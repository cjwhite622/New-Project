import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {zipSync} from 'fflate';
const files={};
async function collect(path){
  for(const entry of await readdir(path,{withFileTypes:true})){
    const file=join(path,entry.name);
    if(file.replaceAll('\\','/')==='docs/original-vision.md')continue;
    if(entry.isDirectory())await collect(file);
    else if(entry.isFile())files['The-Hub/'+file.replaceAll('\\','/')]=new Uint8Array(await readFile(file));
  }
}
for(const dir of ['server','src','config','electron','build','docs','scripts','tests','.github'])await collect(dir);
for(const file of ['package.json','package-lock.json','index.html','tsconfig.json','vite.config.ts','.gitignore','README.md'])files['The-Hub/'+file]=new Uint8Array(await readFile(file));
await mkdir('release',{recursive:true});
const {version}=JSON.parse(await readFile('package.json','utf8'));
await writeFile(`release/The-Hub-source-${version}.zip`,zipSync(files,{level:6}));
process.stdout.write(`Source release contains ${Object.keys(files).length} files. Credentials, databases, build caches and dependencies excluded.\n`);
