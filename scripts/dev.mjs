import { spawn } from 'node:child_process';
const env={...process.env,NODE_ENV:'development'};
const server=spawn(process.execPath,['server/index.mjs'],{stdio:'inherit',env});
const ui=spawn(process.execPath,['node_modules/vite/bin/vite.js'],{stdio:'inherit',env});
function stop(){server.kill('SIGTERM');ui.kill('SIGTERM');}
process.on('SIGINT',stop);process.on('SIGTERM',stop);server.on('exit',stop);ui.on('exit',stop);
