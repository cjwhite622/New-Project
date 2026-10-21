import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { backup } from 'node:sqlite';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HubError,parse,text } from './validation.mjs';
import { z } from 'zod';

export function createApp(hub,{token,development=false}){
  const app=express();app.disable('x-powered-by');
  app.use((req,res,next)=>{
    res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','no-referrer');res.set('Cache-Control','no-store');
    res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const host=req.hostname;
    if(!['localhost','127.0.0.1','[::1]'].includes(host))return res.status(403).json({error:'Loopback host required.'});
    const origin=req.get('origin');
    const allowed=new Set([`http://${req.get('host')}`]);
    if(development){allowed.add('http://localhost:5173');allowed.add('http://127.0.0.1:5173');}
    if(origin&&!allowed.has(origin))return res.status(403).json({error:'Foreign origin rejected.'});
    next();
  });
  app.use(express.json({limit:'700kb'}));
  app.get('/api/session',(req,res)=>{
    if(!development||req.get('x-hub-bootstrap')!=='1')return res.status(403).json({error:'Launch the desktop application to access this session.'});
    res.json({token});
  });
  app.use('/api',(req,res,next)=>{
    const supplied=req.get('authorization')?.replace(/^Bearer /,'')??'';
    const a=Buffer.from(supplied),b=Buffer.from(token);
    if(a.length!==b.length||!timingSafeEqual(a,b))return res.status(401).json({error:'Session expired. Reopen the app.'});next();
  });
  const get=(path,fn)=>app.get('/api'+path,async(req,res)=>res.json(await fn(req)));
  const post=(path,fn)=>app.post('/api'+path,async(req,res)=>res.json((await fn(req))??{ok:true}));
  get('/state',()=>hub.state());
  post('/interview',req=>hub.saveInterview(req.body));
  post('/profile',req=>hub.saveProfile(req.body));
  post('/pause',req=>hub.setPaused(req.body.paused));
  post('/providers/:id',req=>hub.saveProvider(req.params.id,req.body));
  post('/providers/:id/models',req=>hub.checkProviderModels(req.params.id));
  post('/agents/:id',req=>hub.saveAgent(req.params.id,req.body));
  post('/rules',req=>hub.saveRules(req.body));
  get('/brand',()=>({content:hub.store.get('brandBible','Use clear, accurate language. No unsupported claims. Be useful and specific.')}));
  post('/brand',req=>{hub.requireOwner();const value=parse(z.object({content:text.max(20000)}),req.body);hub.store.set('brandBible',value.content);hub.store.log('owner','brand.updated');return value;});
  post('/jobs',req=>{const job=hub.enqueue(req.body);void hub.drain();return job;});
  post('/launch/brief',req=>hub.saveLaunchBrief(req.body));
  post('/launch/drafts',req=>{const batch=hub.prepareLaunchDrafts(req.body);void hub.drain();return batch;});
  post('/launch/review',req=>hub.reviewLaunchPack(req.body));
  post('/connections/shopify',req=>hub.saveShopifyConnection(req.body));
  post('/connections/shopify/check',()=>hub.checkShopifyConnection());
  post('/connections/shopify/disconnect',()=>hub.disconnectShopify());
  post('/shopify/page',req=>{const page=hub.prepareShopifyPage(req.body);void hub.drain();return page;});
  post('/shopify/page/edit',req=>hub.saveShopifyPage(req.body));
  post('/shopify/page/review',req=>hub.reviewShopifyPage(req.body));
  post('/shopify/page/check',req=>hub.reconcileShopifyPage(req.body));
  post('/shopify/page/confirm-not-created',req=>hub.confirmShopifyNotCreated(req.body));
  post('/shopify/page/resolve-review',req=>hub.resolveShopifyPageReview(req.body));
  get('/events',()=>hub.events());
  get('/chats',()=>hub.chatConversations());
  get('/chats/:id',req=>hub.chatConversation(req.params.id));
  post('/chat/messages',req=>{const conversation=hub.sendChatMessage(req.body);void hub.drain();return conversation;});
  post('/chat/review',req=>hub.reviewChatReply(req.body));
  get('/approvals',()=>hub.approvals());
  post('/approvals',req=>hub.propose(req.body));
  post('/approvals/:id/edit',req=>hub.editApproval(req.params.id,req.body));
  post('/approvals/:id/decision',req=>{const a=hub.decideApproval(req.params.id,req.body);if(a.actionType==='shopify-draft-page'&&a.execution==='queued')void hub.drain();return a;});
  post('/approvals/:id/veto',req=>hub.veto(req.params.id));
  get('/finance',req=>hub.finance(req.query.month));
  get('/ledger',()=>hub.ledger());
  post('/ledger',req=>{hub.requireOwner();return hub.addLedger(req.body);});
  post('/import/preview',req=>{hub.requireOwner();return hub.previewCsv(req.body.csv);});
  post('/import',req=>{hub.requireOwner();return hub.importCsv(req.body.csv);});
  post('/time',req=>hub.addTime(req.body));
  get('/usage/unknown',()=>hub.unknownUsage());
  post('/usage/:id/resolve',req=>hub.resolveUsage(req.params.id,req.body));
  get('/proof',()=>hub.proof());
  get('/audit',()=>({entries:hub.audit(),integrity:hub.verifyAudit()}));
  get('/personal',()=>{hub.requireOwner();return hub.personal.get();});
  post('/personal',req=>hub.personal.save(req.body));
  get('/backup',async()=>{
    const temporary=await mkdtemp(join(tmpdir(),'hub-backup-'));
    try{
      await backup(hub.store.db,join(temporary,'business.sqlite'));
      return {format:'the-hub-business-backup',version:1,createdAt:new Date().toISOString(),business:(await readFile(join(temporary,'business.sqlite'))).toString('base64'),note:'Business database only. Private Life Coach data and provider keys excluded.'};
    }finally{await rm(temporary,{recursive:true,force:true});}
  });
  get('/personal/export',()=>{hub.requireOwner();return {format:'the-hub-private-personal',data:hub.personal.get(),notice:'This export contains private personal information.'};});
  app.use('/api',(req,res)=>res.status(404).json({error:'Unknown API route.'}));
  const dist=fileURLToPath(new URL('../dist/',import.meta.url));
  app.use(express.static(dist,{index:'index.html'}));
  app.use((error,req,res,next)=>{
    if(res.headersSent)return next(error);
    const status=error instanceof HubError?error.status:error.type==='entity.too.large'?413:error instanceof SyntaxError?400:500;
    res.status(status).json({error:status===500?'The request could not complete. Your stored data is unchanged.':error.message});
  });
  return app;
}
