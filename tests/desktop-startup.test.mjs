import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const {createStartupReporter,closeDesktop,ensureConsoleStreams}=createRequire(import.meta.url)('../electron/startup-report.cjs');

test('GUI launch survives absent Windows console handles without emitting private output',()=>{
  const target={};
  const stages=[];
  Object.defineProperty(target,'stderr',{configurable:true,get(){throw Object.assign(new Error('invalid GUI console handle'),{code:'EBADF'});}});
  Object.defineProperty(target,'stdout',{configurable:true,get(){throw Object.assign(new Error('invalid GUI console handle'),{code:'EBADF'});}});
  ensureConsoleStreams(target,{record(stage){stages.push(stage);}});
  assert.equal(target.stderr.isTTY,false);
  assert.equal(target.stdout.isTTY,false);
  assert.doesNotThrow(()=>target.stderr.write('private diagnostic content'));
  assert.deepEqual(stages,['console-stdout-unavailable','console-stderr-unavailable']);
});

test('valid console streams retain their identity and unrelated failures are not hidden',()=>{
  const target={stdout:{isTTY:true},stderr:{isTTY:false}};
  const stdout=target.stdout,stderr=target.stderr;
  ensureConsoleStreams(target,{record(){assert.fail('A valid stream must not be replaced');}});
  assert.equal(target.stdout,stdout);
  assert.equal(target.stderr,stderr);
  const broken={};
  const unrelated=Object.assign(new Error('unrelated failure'),{code:'EACCES'});
  Object.defineProperty(broken,'stdout',{get(){throw unrelated;}});
  assert.throws(()=>ensureConsoleStreams(broken,{record(){}}),unrelated);
});

test('the local server imports when the GUI has no usable stderr handle',()=>{
  const script=`
    import {createRequire} from 'node:module';
    const {ensureConsoleStreams}=createRequire(import.meta.url)('./electron/startup-report.cjs');
    Object.defineProperty(process,'stderr',{configurable:true,get(){throw Object.assign(new Error('missing console'),{code:'EBADF'});}});
    ensureConsoleStreams(process,{record(){}});
    const {createApp}=await import('./server/app.mjs');
    if(typeof createApp!=='function')process.exitCode=1;
  `;
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,result.stderr||result.error?.message);
});

test('startup report records the boundary and error code without private error content',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'hub-report-'));
  try{
    const report=createStartupReporter({directories:[directory],version:'0.1.1'});
    report.record('opening-workspace');
    const error=Object.assign(new Error('private-owner-data secret-api-key session=secret-token'),{code:'SQLITE_CANTOPEN',errno:14});
    report.record('failed',{error});
    const text=await readFile(report.path,'utf8');
    const entries=text.trim().split('\n').map(line=>JSON.parse(line));
    assert.equal(entries[0].stage,'opening-workspace');
    assert.deepEqual(entries[1].error,{name:'Error',code:'SQLITE_CANTOPEN',errno:14});
    assert.doesNotMatch(text,/private-owner-data|secret-api-key|secret-token/);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('unwritable diagnostic directories fall back without blocking startup',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'hub-report-'));
  try{
    const blocked=join(directory,'a-file');
    await writeFile(blocked,'not a directory');
    const report=createStartupReporter({directories:[blocked,join(directory,'fallback')],version:'0.1.1'});
    report.record('bootstrap');
    assert.match(await readFile(report.path,'utf8'),/bootstrap/);
    const unavailable=createStartupReporter({directories:[blocked],version:'0.1.1'});
    assert.equal(unavailable.path,undefined);
    assert.doesNotThrow(()=>unavailable.record('bootstrap'));
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('failed startup closes the workspace even when the server never listened',async()=>{
  const calls=[];
  const hub={stop(){calls.push('stop');},async drain(){calls.push('drain');},close(){calls.push('close');}};
  await closeDesktop(hub,undefined);
  assert.deepEqual(calls,['stop','drain','close']);
  calls.length=0;
  await closeDesktop(hub,{listening:false,close(){assert.fail('An unopened server must not be awaited');}});
  assert.deepEqual(calls,['stop','drain','close']);
});

test('workspace closes if draining fails, and a listening server closes before SQLite',async()=>{
  const calls=[];
  const error=new Error('drain failed');
  const hub={stop(){calls.push('stop');},async drain(){throw error;},close(){calls.push('database');}};
  await assert.rejects(closeDesktop(hub,{listening:true,close(callback){calls.push('server');callback();}}),error);
  assert.deepEqual(calls,['stop','server','database']);
});
