import { z } from 'zod';
import { id, now, hash } from './storage.mjs';
import { HubError, parse, text, money } from './validation.mjs';
import { callProvider, estimateCost, ProviderRequestError } from './providers.mjs';
import { businessSystem } from './business-context.mjs';

const localKinds=new Set(['digest','budget-review','guardian-scan','tax-estimate']);
const kindSchema=z.enum(['digest','budget-review','guardian-scan','tax-estimate','draft','brainstorm']);
export function createOrchestrator(hub){
  const {db,get,set,log,event,transaction}=hub.store;
  let running=null,controller=null,stopped=false;
  const jobs=()=>db.prepare('SELECT data FROM jobs ORDER BY rowid DESC LIMIT 200').all().map(r=>JSON.parse(r.data));
  const approvals=()=>db.prepare('SELECT data FROM approvals ORDER BY rowid DESC LIMIT 200').all().map(r=>JSON.parse(r.data));
  const updateJob=job=>db.prepare('UPDATE jobs SET status=?,data=? WHERE id=?').run(job.status,JSON.stringify(job),job.id);
  const updateApproval=a=>db.prepare('UPDATE approvals SET status=?,version=?,data=? WHERE id=?').run(a.status,a.version,JSON.stringify(a),a.id);
  for(const row of db.prepare("SELECT data FROM jobs WHERE status='running'").all()){
    const job=JSON.parse(row.data);job.status='failed';job.error='Application stopped during execution. Billing outcome is unknown; inspect the provider before retrying.';job.completedAt=now();updateJob(job);db.prepare("UPDATE usage SET state='unknown' WHERE job_id=? AND state='reserved'").run(job.id);log('orchestrator','job.interrupted',{jobId:job.id});
  }
  function propose(input){
    hub.requireOwner();
    const value=parse(z.object({agentId:text.max(80),kind:z.enum(['publish','launch','spend','investment','budget','guardian']),title:text.max(200),why:text.max(4000),recommendation:text.max(4000),content:text.max(20000),costCents:money,risk:z.enum(['low','medium','high']),expectedOutcome:text.max(2000),jobId:z.string().optional()}),input);
    if(!hub.agents().some(a=>a.id===value.agentId))throw new HubError('Unknown agent.');
    if(value.agentId==='life-coach')throw new HubError('Personal approvals cannot enter the business queue.',403);
    const approval={...value,id:id(),status:'pending',version:1,createdAt:now(),execution:'not_authorized'};
    db.prepare('INSERT INTO approvals VALUES (?,?,?,?)').run(approval.id,approval.status,approval.version,JSON.stringify(approval));
    log(value.agentId,'approval.proposed',{approvalId:approval.id,kind:approval.kind,title:approval.title,costCents:approval.costCents});event(value.agentId,'manager','approval.proposed',{approvalId:approval.id});return approval;
  }
  function editApproval(approvalId,input){
    hub.requireOwner();const value=parse(z.object({version:z.number().int().positive(),content:text.max(20000)}),input);
    const row=db.prepare('SELECT data FROM approvals WHERE id=?').get(approvalId);if(!row)throw new HubError('Approval not found.',404);
    const a=JSON.parse(row.data);if(a.version!==value.version)throw new HubError('This card changed. Refresh before deciding.',409);
    if(a.status==='denied'||a.status==='vetoed')throw new HubError('This decision is closed.',409);
    a.content=value.content;a.version++;a.status='pending';a.execution='not_authorized';delete a.decidedAt;
    updateApproval(a);log('owner','approval.edited',{approvalId,version:a.version});return a;
  }
  function decideApproval(approvalId,input){
    hub.requireOwner();const value=parse(z.object({version:z.number().int().positive(),decision:z.enum(['approve','deny'])}),input);
    const row=db.prepare('SELECT data FROM approvals WHERE id=?').get(approvalId);if(!row)throw new HubError('Approval not found.',404);
    const a=JSON.parse(row.data);
    if(a.version!==value.version)throw new HubError('This card changed. Review the latest version.',409);
    if(a.status!=='pending')throw new HubError('This card has already been decided.',409);
    if(value.decision==='approve' && get('paused'))throw new HubError('The team is paused. Resume before approving.',409);
    a.status=value.decision==='approve'?'approved':'denied';a.decidedAt=now();
    a.execution=value.decision==='approve'?'connection_required':'not_authorized';
    if(['budget','guardian'].includes(a.kind)&&value.decision==='approve')a.execution='settings_required';
    updateApproval(a);log('owner',`approval.${a.status}`,{approvalId,version:a.version});event('owner','manager',`approval.${a.status}`,{approvalId});return a;
  }
  function enqueue(input,options={}){
    hub.requireOwner();if(get('paused'))throw new HubError('Your team is paused.',409);
    const value=parse(z.object({agentId:text.max(80),kind:kindSchema,prompt:z.string().max(12000).default(''),requestId:text.max(150)}),input);
    const existing=db.prepare('SELECT data FROM jobs WHERE request_id=?').get(value.requestId);if(existing)return JSON.parse(existing.data);
    const agent=hub.agents().find(a=>a.id===value.agentId);
    if(!agent||agent.enabled===false)throw new HubError('Agent is unavailable.');
    if(agent.department==='personal')throw new HubError('Use the private personal space for Life Coach data.',403);
    if(!localKinds.has(value.kind)&&!value.prompt.trim())throw new HubError('Describe the task.');
    const required={'digest':'manager','budget-review':'bookkeeper','guardian-scan':'guardian','tax-estimate':'tax'};
    if(required[value.kind]&&required[value.kind]!==agent.id)throw new HubError('Choose the agent responsible for this local task.');
    const workflow=options.workflow?parse(z.object({type:z.literal('launch'),batchId:text.max(100),stage:z.enum(['offer','asset','copy'])}).strict(),options.workflow):null;
    const title=options.title?parse(text.max(150),options.title):null;
    const job={...value,...(workflow?{workflow}:{}),...(title?{title}:{}),id:id(),status:'queued',tier:localKinds.has(value.kind)?0:(agent.id==='manager'||agent.id==='portfolio'?2:1),createdAt:now(),result:null,error:null,inputTokens:0,outputTokens:0,costCents:0,cached:false};
    db.prepare('INSERT INTO jobs VALUES (?,?,?,?)').run(job.id,job.requestId,job.status,JSON.stringify(job));
    log('orchestrator','job.queued',{jobId:job.id,agentId:job.agentId,kind:job.kind,tier:job.tier});event('owner',job.agentId,'task.queued',{jobId:job.id,kind:job.kind});return job;
  }
  function local(job){
    const p=hub.profile(),f=hub.finance();const fmt=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:p.currency}).format(c/100);
    if(job.kind==='digest')return `${p.name}, here is your business brief.\n\nRecorded revenue this month: ${fmt(f.revenueCents)}. Recorded costs: ${fmt(f.expenseCents)}. Recorded profit: ${fmt(f.profitCents)}. These entries are unverified.\n\n${approvals().filter(a=>a.status==='pending').length} decisions need your review. Your API budget has ${fmt(Math.max(0,p.apiBudgetCents-f.apiSpendCents))} remaining.\n\nNext step: ${f.entries?'Review the ledger against payment statements.':'Record your first transaction, then review your business offer.'} Your team will use the ${hub.playbooks().find(b=>b.id===p.model)?.name} playbook.\n\nNo live store or publishing account is connected yet.`;
    if(job.kind==='budget-review')return `Monthly budget review\n\nOperating costs recorded: ${fmt(f.expenseCents)} of ${fmt(p.operatingBudgetCents)}.\nAPI usage estimate: ${fmt(f.apiSpendCents)} of ${fmt(p.apiBudgetCents)}.\nHard monthly ceiling: ${fmt(p.hardCapCents)}.\n\nProvider calls reserve their maximum estimated cost before dispatch. Actual token usage settles the estimate. An unknown outcome keeps the reservation until reviewed. No paid request is automatically retried.`;
    if(job.kind==='tax-estimate')return `Provisional tax reserve: ${fmt(f.taxReserveCents)}\n\n${f.taxRate}% of positive recorded monthly profit. Available after reserve: ${fmt(f.availableCents)}.\n\nThis is an owner-configured planning estimate, not a tax calculation for ${p.jurisdiction}. Confirm with a licensed professional. No funds were moved.`;
    const check=hub.systemCheck();return `Guardian local inspection\n\n${check.map(c=>`${c.state==='ready'?'PASS':'REVIEW'} · ${c.label}: ${c.detail}`).join('\n\n')}\n\nPermissions are defined per agent. Public posting, investment execution and arbitrary code execution are unavailable in this release. This inspection does not certify legal or platform compliance.`;
  }
  async function cloud(job){
    const p=hub.profile();const agent=hub.agents().find(a=>a.id===job.agentId);const month=now().slice(0,7);
    const launchContext=job.workflow?.type==='launch'?hub.launchJobContext(job):'';
    if(p.currency!=='USD')throw new HubError('Cloud tasks currently require a USD budget. Currency conversion policy is not configured.',409);
    const used=db.prepare('SELECT COALESCE(SUM(input_tokens+output_tokens+reserved_tokens),0) AS tokens FROM usage WHERE agent_id=? AND month=?').get(agent.id,month).tokens;
    if(used>=agent.tokenBudget)throw new HubError('Agent token budget reached 100%. Review and explicitly raise its limit in Settings.',409);
    if(used>=agent.tokenBudget*.8){job.tier=1;event('orchestrator','manager','budget.downgraded',{agentId:agent.id});}
    const provider=hub.providers().filter(provider=>provider.enabled&&provider.connected).sort((a,b)=>(job.tier===2?a.premiumInputPerMillion+a.premiumOutputPerMillion:a.inputPerMillion+a.outputPerMillion)-(job.tier===2?b.premiumInputPerMillion+b.premiumOutputPerMillion:b.inputPerMillion+b.outputPerMillion))[0];
    if(!provider)throw new HubError('Connect and enable a model provider in Settings before starting a cloud task.',409);
    const system=businessSystem({profile:p,agent,brandBible:get('brandBible','Use plain, accurate language. No unverified earnings, health or performance claims.')})+launchContext;
    const cacheKey=hash([provider.id,job.tier,provider.model,provider.premiumModel,system,job.prompt]);
    const cached=db.prepare('SELECT result FROM cache WHERE key=? AND expires_at>?').get(cacheKey,now());
    if(cached){job.cached=true;job.result=JSON.parse(cached.result).text;return;}
    const inputBound=Buffer.byteLength(system+job.prompt)+256;const outputBound=Math.min(1200,agent.tokenBudget-used-inputBound);
    if(outputBound<100)throw new HubError('Not enough agent token budget for this request. Shorten it or review the limit.',409);
    const cost=estimateCost({inputTokens:inputBound,outputTokens:outputBound,provider,tier:job.tier});
    transaction(()=>{
      const sums=db.prepare('SELECT COALESCE(SUM(cost_cents),0) AS cost, COALESCE(SUM(reserved_cents),0) AS reserved FROM usage WHERE month=?').get(month);
      const f=hub.finance(month);
      if(sums.cost+sums.reserved+cost>p.apiBudgetCents || f.expenseCents+sums.reserved+cost>p.operatingBudgetCents || f.expenseCents+sums.reserved+cost>p.hardCapCents)throw new HubError('Budget limit would be exceeded. Review your API, operating and hard limits in Settings.',409);
      db.prepare('INSERT INTO usage (id,job_id,agent_id,month,input_tokens,output_tokens,cost_cents,reserved_cents,reserved_tokens,state,provider,at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id(),job.id,job.agentId,month,0,0,0,cost,inputBound+outputBound,'reserved',provider.id,now());
    });
    job.reservedCents=cost;updateJob(job);event('orchestrator',agent.id,'provider.reserved',{jobId:job.id,provider:provider.id},cost);
    controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),90000);
    let settled=false;
    try{
      const result=await callProvider({provider,key:hub.vault.get(provider.id),system,prompt:job.prompt,tier:job.tier,signal:controller.signal,fetchImpl:hub.fetchImpl,maxOutputTokens:outputBound});
      const actual=estimateCost({...result,provider,tier:job.tier});
      transaction(()=>{
        db.prepare("UPDATE usage SET input_tokens=?,output_tokens=?,cost_cents=?,reserved_cents=0,reserved_tokens=0,state='settled' WHERE job_id=?").run(result.inputTokens,result.outputTokens,actual,job.id);
        db.prepare('INSERT INTO ledger (id,date,kind,amount_cents,category,description,source,external_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id(),now().slice(0,10),'expense',actual,'api',`${provider.name} · ${agent.name} · usage-based estimate`,'api',job.id,now());
        if(result.complete){db.prepare('INSERT OR REPLACE INTO cache VALUES (?,?,?)').run(cacheKey,JSON.stringify(result),new Date(Date.now()+86400000).toISOString());set(`provider-check:${provider.id}`,now());}
        log(agent.id,result.complete?'provider.completed':'provider.incomplete',{jobId:job.id,provider:provider.id,model:result.model,inputTokens:result.inputTokens,outputTokens:result.outputTokens,costCents:actual,pricing:'configured estimate, verify invoice'});
      });
      settled=true;
      Object.assign(job,{inputTokens:result.inputTokens,outputTokens:result.outputTokens,costCents:actual,provider:provider.id,model:result.model,reservedCents:0});
      if(!result.complete)throw new HubError('The provider returned an incomplete response. Known token usage was recorded. The partial draft was not cached, completed, or retried.',422);
      job.result=result.text;
    }catch(error){
      if(settled)throw error;
      if(error instanceof ProviderRequestError&&error.rejected){
        db.prepare("UPDATE usage SET state='rejected',reserved_cents=0,reserved_tokens=0 WHERE job_id=?").run(job.id);
        job.reservedCents=0;
        log(agent.id,'provider.rejected',{jobId:job.id,provider:provider.id});
        throw new HubError(`The provider rejected the request before generation. Its cost reservation was released. ${error.message}`,502);
      }
      db.prepare("UPDATE usage SET state='unknown' WHERE job_id=?").run(job.id);
      throw new HubError('Provider execution outcome is unknown. The cost reservation is retained. Check provider billing before retrying. '+(error instanceof HubError?error.message:'The request was interrupted or could not be completed.'),502);
    }finally{clearTimeout(timeout);controller=null;}
  }
  async function process(){
    while(!stopped&&!get('paused')){
      const row=db.prepare("SELECT data FROM jobs WHERE status='queued' ORDER BY rowid LIMIT 1").get();if(!row)break;
      const job=JSON.parse(row.data);job.status='running';job.startedAt=now();updateJob(job);event('orchestrator',job.agentId,'task.started',{jobId:job.id});
      try{
        if(localKinds.has(job.kind))job.result=local(job);else await cloud(job);
        job.status='completed';job.completedAt=now();updateJob(job);log(job.agentId,'job.completed',{jobId:job.id,kind:job.kind,tier:job.tier,costCents:job.costCents,cached:job.cached});event(job.agentId,'manager','agent.completed',{jobId:job.id});
        const count=jobs().filter(j=>j.agentId===job.agentId&&j.kind===job.kind&&j.status==='completed').length;
        if(count===10)event('orchestrator','manager','distillation.candidate',{agentId:job.agentId,kind:job.kind,successes:10});
      }catch(error){
        job.status=error.status===409?'blocked':'failed';job.error=error instanceof HubError?error.message:'The task could not complete. No automatic retry was made.';job.completedAt=now();updateJob(job);log('orchestrator',`job.${job.status}`,{jobId:job.id,reason:job.error});event('orchestrator','manager',`task.${job.status}`,{jobId:job.id});
        if(job.status==='blocked' && /budget/i.test(job.error))propose({agentId:job.agentId,kind:'budget',title:'Review a blocked task budget',why:job.error,recommendation:'Review usage and adjust the limit only if appropriate.',content:`Task ${job.kind} is paused. Approval alone does not change a spending limit.`,costCents:0,risk:'medium',expectedOutcome:'A deliberate budget decision',jobId:job.id});
      }
    }
  }
  const drain=()=>{if(!running)running=process().finally(()=>{running=null;});return running;};
  function setPaused(paused){
    const value=parse(z.boolean(),paused);set('paused',value);if(value)controller?.abort();log('owner',value?'team.paused':'team.resumed');event('owner','orchestrator',value?'team.paused':'team.resumed');if(!value)void drain();return {paused:value};
  }
  function veto(approvalId){const row=db.prepare('SELECT data FROM approvals WHERE id=?').get(approvalId);if(!row)throw new HubError('Approval not found.',404);const a=JSON.parse(row.data);a.status='vetoed';a.execution='not_authorized';a.version++;updateApproval(a);log('guardian','approval.vetoed',{approvalId});return a;}
  const unknownUsage=()=>db.prepare("SELECT job_id as jobId,agent_id as agentId,provider,reserved_cents as reservedCents,at FROM usage WHERE state='unknown'").all();
  function resolveUsage(jobId,input){
    hub.requireOwner();const value=parse(z.object({costCents:money,inputTokens:z.number().int().min(0).max(100000000),outputTokens:z.number().int().min(0).max(100000000),note:text.max(1000)}),input);
    return transaction(()=>{
      const usage=db.prepare('SELECT * FROM usage WHERE job_id=?').get(jobId);
      if(!usage)throw new HubError('Usage record not found.',404);
      if(usage.state!=='unknown')throw new HubError('This usage record has already been resolved or is still active.',409);
      db.prepare("UPDATE usage SET input_tokens=?,output_tokens=?,cost_cents=?,reserved_cents=0,reserved_tokens=0,state='reconciled' WHERE job_id=?").run(value.inputTokens,value.outputTokens,value.costCents,jobId);
      const row=db.prepare('SELECT data FROM jobs WHERE id=?').get(jobId);if(row){const job=JSON.parse(row.data);Object.assign(job,{inputTokens:value.inputTokens,outputTokens:value.outputTokens,costCents:value.costCents,reservedCents:0,billingReconciled:true});updateJob(job);}
      if(value.costCents>0)db.prepare('INSERT INTO ledger VALUES (?,?,?,?,?,?,?,?,?)').run(id(),usage.at.slice(0,10),'expense',value.costCents,'api',`${usage.provider} · owner-reconciled API charge`,'api',jobId,now());
      log('owner','provider.usage_reconciled',{jobId,...value,evidence:'owner-reported provider billing check'});return {resolved:true};
    });
  }
  return {jobs,approvals,enqueue,propose,editApproval,decideApproval,veto,drain,setPaused,unknownUsage,resolveUsage,stop(){stopped=true;controller?.abort();}};
}
