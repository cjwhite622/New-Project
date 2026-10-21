import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { getPath7za } from 'app-builder-lib/out/toolsets/7zip.js';

const root = resolve('.');
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const staging = join(root, 'release', 'portable-staging');
const destination = join(staging, 'The Hub');
const output = join(root, 'release', `The-Hub-${manifest.version}-Windows-x64.zip`);

await rm(staging, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(join(root, 'release', 'win-unpacked'), destination, { recursive: true });
const launcher = (await readFile(join(root, 'build', 'Start The Hub.cmd'), 'utf8'))
  .replace(/Application version: [^\r\n]+/, `Application version: ${manifest.version}`)
  .replace(/\r?\n/g, '\r\n');
await writeFile(join(destination, 'Start The Hub.cmd'), launcher);
await cp(join(root, 'build', 'PORTABLE-README.txt'), join(destination, 'READ ME FIRST.txt'));
await rm(output, { force: true });
const binary = await getPath7za();
await new Promise((resolve, reject) => {
  const child = spawn(binary, ['a', '-tzip', '-mx=5', output, 'The Hub'], {
    cwd: staging,
    stdio: 'inherit',
  });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Portable archive build exited ${code}`)));
});
process.stdout.write(`Portable Windows application: ${output}\n`);
