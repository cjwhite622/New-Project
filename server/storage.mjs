import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export function createStorage(dataDir) {
  mkdirSync(dataDir,{recursive:true,mode:0o700});
  const db=new DatabaseSync(join(dataDir,'business.sqlite'));
  const privateDb=new DatabaseSync(join(dataDir,'personal.sqlite'));
  for (const database of [db,privateDb]) database.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, data TEXT NOT NULL, prev TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY, date TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('income','expense')), amount_cents INTEGER NOT NULL CHECK(amount_cents>0), category TEXT NOT NULL, description TEXT NOT NULL, source TEXT NOT NULL, external_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(source,external_id));
    CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, status TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, sender TEXT NOT NULL, recipient TEXT NOT NULL, task_type TEXT NOT NULL, priority INTEGER NOT NULL, cost_estimate INTEGER NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS usage (id TEXT PRIMARY KEY, job_id TEXT NOT NULL UNIQUE, agent_id TEXT NOT NULL, month TEXT NOT NULL, input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL, cost_cents INTEGER NOT NULL, reserved_cents INTEGER NOT NULL, reserved_tokens INTEGER NOT NULL, state TEXT NOT NULL, provider TEXT NOT NULL, at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, result TEXT NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS time_records (id TEXT PRIMARY KEY, minutes INTEGER NOT NULL CHECK(minutes>0), description TEXT NOT NULL, at TEXT NOT NULL);
  `);
  privateDb.exec('CREATE TABLE IF NOT EXISTS personal (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)');
  for(const file of ['business.sqlite','personal.sqlite']){try{chmodSync(join(dataDir,file),0o600);}catch{ /* Windows uses account ACLs. */ }}
  const get=(key,fallback=null)=>{
    const row=db.prepare('SELECT data FROM documents WHERE key=?').get(key);
    return row ? JSON.parse(row.data) : fallback;
  };
  const set=(key,value)=>db.prepare('INSERT INTO documents VALUES (?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').run(key,JSON.stringify(value));
  const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}};
  const log=(actor,action,data={})=>{
    const at=now();const previous=db.prepare('SELECT hash FROM audit ORDER BY seq DESC LIMIT 1').get()?.hash ?? 'genesis';
    const encoded=JSON.stringify(data);const digest=hash([at,actor,action,encoded,previous]);
    db.prepare('INSERT INTO audit(at,actor,action,data,prev,hash) VALUES (?,?,?,?,?,?)').run(at,actor,action,encoded,previous,digest);
  };
  const audit=(limit=200)=>db.prepare('SELECT * FROM audit ORDER BY seq DESC LIMIT ?').all(limit).map(row=>({...row,data:JSON.parse(row.data)}));
  const verify=()=>{
    let previous='genesis';const rows=db.prepare('SELECT * FROM audit ORDER BY seq').all();
    for (const row of rows) {
      if(row.prev!==previous || row.hash!==hash([row.at,row.actor,row.action,row.data,row.prev]))return {valid:false,brokenAt:row.seq,entries:rows.length};
      previous=row.hash;
    }
    return {valid:true,entries:rows.length,head:previous};
  };
  const event=(sender,recipient,taskType,payload={},costEstimate=0)=>db.prepare('INSERT INTO events(at,sender,recipient,task_type,priority,cost_estimate,payload) VALUES (?,?,?,?,?,?,?)').run(now(),sender,recipient,taskType,1,costEstimate,JSON.stringify(payload));
  return {db,privateDb,get,set,transaction,log,audit,verify,event,close(){db.close();privateDb.close();}};
}
