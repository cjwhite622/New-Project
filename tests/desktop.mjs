import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron } from 'playwright-core';

// A disposable Linux GUI smoke test. Windows compatibility requires a separate
// Windows session; XDG paths must not be mistaken for Windows data isolation.
if (process.platform !== 'linux' || !process.env.DISPLAY) {
  throw new Error('This smoke test requires Linux and an available DISPLAY. It does not test Windows compatibility.');
}
const temporary = await mkdtemp(join(tmpdir(), 'hub-desktop-test-'));
const executable = process.env.HUB_DESKTOP_EXECUTABLE;
let application;
try {
  application = await electron.launch({
    ...(executable ? { executablePath: resolve(executable) } : {}),
    args: [...(executable ? [] : ['.']), '--no-sandbox', '--disable-gpu'],
    env: {
      ...process.env,
      XDG_CONFIG_HOME: join(temporary, 'config'),
      XDG_CACHE_HOME: join(temporary, 'cache'),
    },
    timeout: 30000,
  });
  process.stdout.write('Electron process started; waiting for the interview window.\n');
  const window = await application.firstWindow({ timeout: 30000 });
  await window.getByLabel('Your name or nickname').waitFor({ timeout: 30000 });
  await access(join(temporary, 'config', 'The Hub', 'workspace', 'business.sqlite'));
  const startupLog = await readFile(join(temporary, 'config', 'The Hub', 'diagnostics', 'desktop-startup.log'), 'utf8');
  assert.ok(startupLog.trim().split('\n').map(line => JSON.parse(line)).some(entry => entry.stage === 'window-loaded'));
  assert.doesNotMatch(startupLog, /session=|http:\/\/|Bearer |Desktop test owner/);
  assert.equal(await window.evaluate(() => typeof window.require), 'undefined');
  await window.getByLabel('Your name or nickname').fill('Desktop test owner');
  await window.getByRole('button', { name: 'Continue', exact: true }).click();
  await window.getByRole('heading', { name: 'Good to meet you, Desktop test owner. Where are you starting?' }).waitFor();
  await mkdir('test-results', { recursive: true });
  await window.screenshot({ path: `test-results/desktop-${executable ? 'packaged' : 'source'}.png` });
  process.stdout.write(`${executable ? 'Packaged' : 'Source'} Electron GUI launch, local API, interview and renderer isolation passed on Linux.\n`);
} finally {
  if (application) await application.close();
  await rm(temporary, { recursive: true, force: true });
}
