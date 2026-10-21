import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { createHub } from './hub.mjs';
import { createApp } from './app.mjs';
const hub=createHub({dataDir:resolve(process.env.HUB_DATA_DIR||'.hub-data')});
const app=createApp(hub,{token:randomBytes(32).toString('hex'),development:process.env.NODE_ENV!=='production'});
const port=Number(process.env.PORT||4318);
const server=app.listen(port,'127.0.0.1',()=>{process.stdout.write(`The Hub local service: http://127.0.0.1:${port}\n`);void hub.drain();});
function close(){hub.stop();Promise.resolve(hub.drain()).finally(()=>server.close(()=>{hub.close();process.exit(0);}));}
process.once('SIGINT',close);process.once('SIGTERM',close);
