const {app,BrowserWindow,safeStorage,dialog}=require('electron');
const {randomBytes}=require('node:crypto');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {readFileSync,writeFileSync,existsSync,mkdirSync,renameSync}=require('node:fs');
const {createStartupReporter,closeDesktop,ensureConsoleStreams}=require('./startup-report.cjs');
let server,hub,window,quitting=false,failed=false,exitCode=0;
app.setName('The Hub');
const reportDirectories=[join(tmpdir(),'The Hub','diagnostics')];
try{reportDirectories.unshift(join(app.getPath('userData'),'diagnostics'));}catch{}
const report=createStartupReporter({directories:reportDirectories,version:app.getVersion()});
let stage='bootstrap';
function recordStage(next){stage=next;report.record(stage);}
recordStage('bootstrap');
function fail(error){
  if(failed||quitting)return;
  failed=true;exitCode=1;
  report.record('failed',{error});
  const code=typeof error?.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(error.code)?` (${error.code})`:'';
  dialog.showErrorBox('The Hub could not start',`Startup stopped at: ${stage}${code}.\n\n${report.path?`A diagnostic report is saved at:\n${report.path}`:'The diagnostic report could not be written.'}\n\nYour stored business data has not been removed.`);
  app.quit();
}
process.on('uncaughtException',fail);
process.on('unhandledRejection',fail);
app.on('child-process-gone',(_event,details)=>report.record('child-process-exited',{reason:details.reason,exitCode:details.exitCode}));
function createVault(dataDir){
  const file=join(dataDir,'credentials.encrypted.json');const memory=new Map();
  const persistent=safeStorage.isEncryptionAvailable() && (process.platform!=='linux'||safeStorage.getSelectedStorageBackend()!=='basic_text');
  function read(){if(!persistent||!existsSync(file))return {};try{return JSON.parse(readFileSync(file,'utf8'));}catch{return {};}}
  return {persistent,
    get(key){if(!persistent)return memory.get(key);try{const encoded=read()[key];return encoded?safeStorage.decryptString(Buffer.from(encoded,'base64')):undefined;}catch{return undefined;}},
    set(key,value){if(!persistent){if(value)memory.set(key,value);else memory.delete(key);return;}const data=read();if(value)data[key]=safeStorage.encryptString(value).toString('base64');else delete data[key];const temporary=file+'.tmp';writeFileSync(temporary,JSON.stringify(data),{mode:0o600});renameSync(temporary,file);}
  };
}
async function launch(){
  recordStage('checking-console-streams');
  ensureConsoleStreams(process,report);
  recordStage('loading-local-server');
  const {createHub}=await import('../server/hub.mjs');const {createApp}=await import('../server/app.mjs');
  recordStage('opening-workspace');
  const dataDir=join(app.getPath('userData'),'workspace');mkdirSync(dataDir,{recursive:true,mode:0o700});
  hub=createHub({dataDir,vault:createVault(dataDir)});
  recordStage('starting-local-server');
  const token=randomBytes(32).toString('hex');server=createApp(hub,{token}).listen(0,'127.0.0.1');
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const origin=`http://127.0.0.1:${server.address().port}`;
  recordStage('creating-window');
  window=new BrowserWindow({width:1440,height:980,minWidth:780,minHeight:620,title:'The Hub',icon:join(__dirname,'../build/icon.png'),backgroundColor:'#f7f8f5',autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  window.webContents.on('render-process-gone',(_event,details)=>{
    report.record('renderer-exited',{reason:details.reason,exitCode:details.exitCode});
    if(!quitting&&details.reason!=='clean-exit')fail(Object.assign(new Error(),{code:'RENDERER_EXITED'}));
  });
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
  window.webContents.session.setPermissionRequestHandler((contents,permission,callback)=>callback(false));
  recordStage('loading-window');
  await window.loadURL(`${origin}/#session=${token}`);
  window.show();
  recordStage('window-loaded');
  void hub.drain();
}
const lock=app.requestSingleInstanceLock();
if(!lock){report.record('existing-instance');app.quit();}else{
  app.on('second-instance',()=>{report.record('reactivating-window');if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();}});
  app.whenReady().then(launch).catch(fail);
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',event=>{
    if(quitting)return;
    event.preventDefault();quitting=true;
    report.record('closing');
    closeDesktop(hub,server).catch(error=>{exitCode=1;report.record('close-failed',{error});}).finally(()=>app.exit(exitCode));
  });
}
