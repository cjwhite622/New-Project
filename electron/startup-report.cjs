const {appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync} = require('node:fs');
const {join} = require('node:path');
const {Writable} = require('node:stream');

function ensureConsoleStreams(target, report) {
  for (const name of ['stdout', 'stderr']) {
    try {
      // Node creates these streams lazily. A Windows GUI process may inherit an
      // invalid console handle, and debug's import-time color check reads stderr.
      void target[name];
    } catch (error) {
      if (error?.code !== 'EBADF') throw error;
      const sink = new Writable({write(_chunk, _encoding, callback) { callback(); }});
      sink.isTTY = false;
      sink.fd = -1;
      Object.defineProperty(target, name, {configurable: true, enumerable: true, value: sink});
      report.record(`console-${name}-unavailable`, {error});
    }
  }
}

// Deliberately exclude error messages, stacks, URLs, configuration and owner data.
// Startup stage and runtime error codes are enough to locate the failing boundary.
function errorDetails(error) {
  const details = {};
  for (const key of ['name', 'code', 'errno', 'syscall', 'errcode']) {
    const value = error?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) details[key] = value;
    else if (typeof value === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(value)) details[key] = value;
  }
  return details;
}

function createStartupReporter({directories, version}) {
  let path;
  for (const directory of directories) {
    try {
      mkdirSync(directory, {recursive: true, mode: 0o700});
      const candidate = join(directory, 'desktop-startup.log');
      if (existsSync(candidate)) {
        const previous = readFileSync(candidate, 'utf8');
        if (Buffer.byteLength(previous) > 65536) {
          const tail = previous.slice(-32768);
          writeFileSync(candidate, tail.slice(tail.indexOf('\n') + 1), {mode: 0o600});
        }
      }
      appendFileSync(candidate, '', {mode: 0o600});
      path = candidate;
      break;
    } catch {
      // Diagnostics must never prevent startup. Try a temporary directory next.
    }
  }
  function record(stage, {error, exitCode, reason} = {}) {
    if (!path) return;
    const entry = {time: new Date().toISOString(), pid: process.pid, version,
      platform: process.platform, arch: process.arch, electron: process.versions.electron,
      node: process.versions.node, stage};
    if (error) entry.error = errorDetails(error);
    if (Number.isInteger(exitCode)) entry.exitCode = exitCode;
    if (typeof reason === 'string' && /^[a-z-]{1,50}$/.test(reason)) entry.reason = reason;
    try { appendFileSync(path, JSON.stringify(entry) + '\n', {mode: 0o600}); } catch {}
  }
  return {path, record};
}

async function closeDesktop(hub, server) {
  try {
    hub?.stop();
    await hub?.drain();
  } finally {
    try {
      if (server?.listening) await new Promise(resolve => server.close(resolve));
    } finally {
      hub?.close();
    }
  }
}

module.exports = {createStartupReporter, errorDetails, closeDesktop, ensureConsoleStreams};
