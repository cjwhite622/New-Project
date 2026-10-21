import { spawn } from 'node:child_process';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { getMakeNsisPath } from 'app-builder-lib/out/toolsets/windows.js';

const root = resolve('.');
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error('The NSIS release version must contain three numeric components.');
}

async function run(binary, args, env = process.env) {
  await new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: 'inherit', env });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${binary} exited ${code}`)));
  });
}

async function hasEntries(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.length > 0;
  } catch {
    return false;
  }
}

async function resolveAppDir() {
  const candidates = [
    join(root, 'release', 'win-unpacked', 'The Hub-win32-x64'),
    join(root, 'release', 'win-unpacked', 'The Hub'),
    join(root, 'release', 'win-unpacked'),
  ];

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isDirectory() && await hasEntries(candidate)) return candidate;
    } catch {
      // Keep checking the remaining candidates.
    }
  }

  const releaseRoot = join(root, 'release');
  let entries = [];
  try {
    entries = await readdir(releaseRoot, { withFileTypes: true });
  } catch {
    // The directory may not exist yet when the app build failed.
  }

  const fallback = entries
    .filter(entry => entry.isDirectory())
    .map(entry => join(releaseRoot, entry.name))
    .find(candidate => (/(?:^|-)unpacked$/i.test(candidate) || /The Hub.*win/i.test(candidate)) && hasEntries(candidate));

  if (fallback) return fallback;

  throw new Error(
    `Electron Builder did not produce a non-empty unpacked Windows app directory in ${join(root, 'release')}. ` +
    'Check the build output before packaging the installer.'
  );
}

await run(process.execPath, ['node_modules/electron-builder/out/cli/cli.js', '--win', 'dir', '--x64']);
const appDir = await resolveAppDir();
const files = [];
const dirs = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(file);
      dirs.push(file.replace(`${appDir}${'\\'}`, '').replace(/\\/g, '/'));
    } else {
      files.push(file.replace(`${appDir}${'\\'}`, '').replace(/\\/g, '/'));
    }
  }
}

await walk(appDir);

const escape = value => value.replaceAll('$', '$$').replaceAll('"', '$\\"').replaceAll('/', '\\');
const manifest = join(root, 'release', 'uninstall-manifest.nsh');
await writeFile(
  manifest,
  [...files.map(file => `Delete "$INSTDIR\\${escape(file)}"`), ...dirs.map(dir => `RMDir "$INSTDIR\\${escape(dir)}"`)].join('\n') + '\n'
);

const nsis = await getMakeNsisPath();
await run(nsis.path, [
  '-DAPP_DIR=' + appDir,
  '-DAPP_VERSION=' + version,
  '-DOUTPUT_FILE=' + join(root, 'release', `The Hub Setup ${version}.exe`),
  '-DICON_FILE=' + join(root, 'build', 'icon.ico'),
  '-DUNINSTALL_MANIFEST=' + manifest,
  join(root, 'build', 'installer.nsi'),
]);

process.stdout.write('Windows installer built with native NSIS. Owner data is excluded from uninstall.\n');
