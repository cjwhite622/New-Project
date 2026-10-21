import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { createStorage, id, now } from './storage.mjs';
import { createFinance } from './finance.mjs';
import { DEFAULT_PROVIDERS, memoryVault, listMoonshotModels } from './providers.mjs';
import { profileSchema, HubError, parse, money, text } from './validation.mjs';
import { createOrchestrator } from './orchestrator.mjs';

const AGENTS=JSON.parse(readFileSync(new URL('../config/agents.json',import.meta.url),'utf8'));
const PLAYBOOKS=JSON.parse(readFileSync(new URL('../config/playbooks.json',import.meta.url),'utf8'));
const {version:VERSION}=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const DEFAULT_RULES={taxRate:25,refundLimitCents:2500,autoSpendLimitCents:0,autonomyThreshold:10,highRiskOptIn:false,highRiskCap:0,autoApproveTypes:[]};
export function createHub({dataDir,vault=memoryVault(),fetchImpl=fetch}) {
  const store=createStorage(dataDir);
  const {db,get,set,log}=store;
  if(!get('rules'))set('rules',DEFAULT_RULES);
  if(!get('providers'))set('providers',DEFAULT_PROVIDERS);
  if(get('paused')===null)set('paused',false);
  const finance=createFinance(store);
  const agents=()=>AGENTS.map(a=>({...a,...get(`agent:${a.id}`,{})}));
  const profile=()=>get('profile');
  const providers=()=>get('providers').map(p=>({...p,connected:Boolean(vault.get(p.id)),storage:vault.persistent?'os-encrypted':'session-only',verifiedAt:get(`provider-check:${p.id}`)}));
  const requireOwner=()=>{if(!profile())throw new HubError('Complete and confirm the interview first.',409);};
  const saveProvider=(providerId,input)=>{
    requireOwner();
    const schema=z.object({enabled:z.boolean().optional(),model:text.max(120).optional(),premiumModel:text.max(120).optional(),inputPerMillion:z.number().min(0).max(1000).optional(),outputPerMillion:z.number().min(0).max(1000).optional(),premiumInputPerMillion:z.number().min(0).max(1000).optional(),premiumOutputPerMillion:z.number().min(0).max(1000).optional(),key:z.string().max(500).optional()}).strict();
    const change=parse(schema,input);const list=get('providers');
    const provider=list.find(p=>p.id===providerId);if(!provider)throw new HubError('Unknown provider.');
    const {key,...safe}=change;
    if(key!==undefined){vault.set(providerId,key);set(`provider-check:${providerId}`,null);}
    if(safe.model||safe.premiumModel)set(`provider-check:${providerId}`,null);
    Object.assign(provider,safe);set('providers',list);log('owner','provider.configured',{providerId,enabled:provider.enabled});return providers();
  };
  const saveAgent=(agentId,input)=>{
    requireOwner();if(!AGENTS.some(a=>a.id===agentId))throw new HubError('Unknown agent.');
    const change=parse(z.object({tokenBudget:z.number().int().min(0).max(100000000),enabled:z.boolean().optional()}),input);
    set(`agent:${agentId}`,change);log('owner','agent.configured',{agentId,...change});return agents();
  };
  async function checkProviderModels(providerId){
    requireOwner();
    if(providerId!=='moonshot')throw new HubError('Available-model checking is currently supported for Kimi / Moonshot only.');
    const key=vault.get(providerId);
    if(!key)throw new HubError('Save a Kimi API key before checking available models.',409);
    try{return {models:await listMoonshotModels({key,fetchImpl,signal:AbortSignal.timeout(15000)})};}
    catch(error){if(error instanceof HubError)throw error;throw new HubError('Could not retrieve Kimi models. Check the network connection. No generation request was sent.',502);}
  }
  const personal={
    get:()=>{const row=store.privateDb.prepare('SELECT data FROM personal WHERE id=1').get();return row?JSON.parse(row.data):{goals:'',notes:'',checkIn:'On my terms',health:'',sleep:'',relationships:'',growth:'',schedule:''};},
    save:input=>{
      requireOwner();const value=parse(z.object({goals:z.string().max(10000),notes:z.string().max(20000),checkIn:z.string().max(200),health:z.string().max(5000).optional(),sleep:z.string().max(5000).optional(),relationships:z.string().max(5000).optional(),growth:z.string().max(5000).optional(),schedule:z.string().max(5000).optional()}),input);
      store.privateDb.prepare('INSERT INTO personal VALUES (1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(value));return value;
    },
  };
  const hub={store,vault,fetchImpl,agents,profile,providers,requireOwner,...finance,personal,saveProvider,saveAgent,checkProviderModels,
    playbooks:()=>PLAYBOOKS,
    saveInterview(input){
      const value=parse(z.object({step:z.number().int().min(0).max(30),answers:z.record(z.string(),z.union([z.string().max(5000),z.number(),z.boolean()]))}),input);
      set('interview',value);return value;
    },
    saveProfile(input){
      const value=parse(profileSchema,input);
      if(profile()&&profile().currency!==value.currency&&(db.prepare('SELECT COUNT(*) as count FROM ledger').get().count||db.prepare('SELECT COUNT(*) as count FROM usage').get().count))throw new HubError('Currency cannot change after finance or provider usage records exist. Create a separate workspace for a different currency.',409);
      const current=finance.finance();
      const reserved=current.usage.reduce((sum,u)=>sum+u.reservedCents,0);
      if(current.apiSpendCents+reserved>value.apiBudgetCents||current.expenseCents+reserved>value.operatingBudgetCents||current.expenseCents+reserved>value.hardCapCents)throw new HubError('Budgets cannot be lower than recorded costs plus reserved commitments this month.');
      set('profile',value);log('owner','profile.confirmed',{model:value.model,weeklyHours:value.weeklyHours,currency:value.currency});return value;
    },
    rules:()=>get('rules'),
    saveRules(input){
      requireOwner();const value=parse(z.object({taxRate:z.number().min(0).max(60),refundLimitCents:money,autoSpendLimitCents:money,autonomyThreshold:z.number().int().min(10).max(100),highRiskOptIn:z.boolean(),highRiskCap:z.number().min(0).max(10),autoApproveTypes:z.array(z.enum(['digest','budget-review','guardian-scan','tax-estimate'])).max(4)}),input);
      if(!value.highRiskOptIn && value.highRiskCap!==0)throw new HubError('High-risk allocation needs explicit opt-in.');
      set('rules',value);log('owner','rules.updated',value);return value;
    },
    agentMemory(agentId,target){if(agentId!=='life-coach' && target==='life-coach')throw new HubError('Life Coach memory is private.',403);return agentId==='life-coach'?personal.get():get(`memory:${target}`,{});},
    audit:()=>store.audit(),verifyAudit:()=>store.verify(),
    events:()=>db.prepare('SELECT * FROM events ORDER BY seq DESC LIMIT 200').all().map(r=>({seq:r.seq,at:r.at,sender:r.sender,recipient:r.recipient,taskType:r.task_type,priority:r.priority,costEstimate:r.cost_estimate,payload:JSON.parse(r.payload)})),
    addTime(input){const value=parse(z.object({minutes:z.number().int().min(1).max(1440),description:text.max(1000)}),input);requireOwner();db.prepare('INSERT INTO time_records VALUES (?,?,?,?)').run(id(),value.minutes,value.description,now());log('owner','time.recorded',value);},
    proof(){
      requireOwner();const records=finance.ledger();
      return {generatedAt:now(),business:profile().brand,currency:profile().currency,incomeProof:'not_verified',note:'Manual and CSV entries are recorded, unverified amounts. No live settlement integration or consistent-income proof is present.',totals:{revenueCents:records.filter(r=>r.kind==='income').reduce((n,r)=>n+r.amountCents,0),expenseCents:records.filter(r=>r.kind==='expense').reduce((n,r)=>n+r.amountCents,0)},ledger:records,monthly:finance.finance(),humanMinutes:db.prepare('SELECT COALESCE(SUM(minutes),0) as minutes FROM time_records').get().minutes,timeEvidence:'self-reported',auditIntegrity:store.verify(),audit:store.audit(100000),taxNotice:'Provisional tax estimate. Confirm with a licensed professional.'};
    },
    systemCheck(){
      const p=profile();return [
        {id:'profile',label:'Owner interview',state:p?'ready':'attention',detail:p?'Profile confirmed.':'Complete the conversation to activate your team.'},
        ...providers().map(provider=>({id:provider.id,label:provider.name,state:provider.connected?(provider.verifiedAt?'ready':'attention'):'attention',detail:provider.connected?(provider.verifiedAt?'A model request has succeeded.':`Key saved ${provider.storage==='session-only'?'for this session':''}; model access not yet tested.`):'Connect an API key when you are ready for cloud tasks.'})),
        {id:'budgets',label:'Spending controls',state:p?'ready':'attention',detail:p?'API, operating and hard limits are enforced before cloud work.':'Budgets will be set during your interview.'},
        {id:'audit',label:'Local audit trail',state:store.verify().valid?'ready':'blocked',detail:`${store.verify().entries} entries; ${store.verify().valid?'hash chain intact':'integrity check failed'}.`},
        {id:'business',label:'Business connections',state:'attention',detail:'Store, payment, booking and publishing adapters are a later release gate.'},
        {id:'income',label:'Verified income',state:'attention',detail:'No independently verified settlement data. Recorded revenue is not income proof.'},
      ];
    },
    state(){return {profile:profile(),interview:get('interview',{step:0,answers:{}}),paused:get('paused'),agents:agents(),playbooks:PLAYBOOKS,providers:providers(),rules:get('rules'),finance:finance.finance(),jobs:hub.jobs(),approvals:hub.approvals(),audit:store.audit(12),systemCheck:hub.systemCheck(),phase:'Phase 0 + 1',version:VERSION,vaultPersistent:Boolean(vault.persistent),unknownUsage:hub.unknownUsage()};},
    close(){hub.stop();store.close();},
  };
  Object.assign(hub,createOrchestrator(hub));
  return hub;
}
