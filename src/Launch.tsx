import {useRef,useState} from 'react';
import {ArrowRight,CheckCircle2,FileText,Layers3,Save,ShieldCheck,Sparkles} from 'lucide-react';
import {api,money,requestId,shortDate} from './api';
import {Badge,Button,PageTitle,Spinner} from './components';
import ShopifyWorkspace from './ShopifyWorkspace';
import type {HubState,Job,LaunchBatch,LaunchBrief,LaunchDirection} from './types';

type DirectionForm=Omit<LaunchDirection,'format'|'channel'>&{format:LaunchDirection['format']|'';channel:LaunchDirection['channel']|''};
export default function Launch({state,refresh,notify,viewJob,navigate}:{state:HubState;refresh:()=>Promise<void>;notify:(text:string,error?:boolean)=>void;viewJob:(job:Job)=>void;navigate:(page:string)=>void}){
  const {brief,batch}=state.launch;const profile=state.profile!;
  const [form,setForm]=useState<DirectionForm>(brief?.direction??{audience:'',transformation:profile.offer,format:'',channel:''});
  const [version,setVersion]=useState(brief?.version??0);const [busy,setBusy]=useState('');const [unconfirmed,setUnconfirmed]=useState(false);
  const draftRequest=useRef<{version:number;requestId:string}|null>(null);
  const normalized={...form,audience:form.audience.trim(),transformation:form.transformation.trim()};
  const changed=!brief||Object.entries(normalized).some(([key,value])=>value!==brief.direction[key as keyof LaunchDirection]);
  const stale=version!==(brief?.version??0);
  const active=batch?.stages.some(s=>s.job&&['queued','running'].includes(s.job.status));
  const complete=batch?.stages.every(s=>s.job?.status==='completed'&&s.job.result);
  const uncertain=batch?.stages.some(s=>state.unknownUsage.some(u=>u.jobId===s.job?.id));
  const connected=state.providers.some(p=>p.connected&&p.enabled);
  const agentsReady=['research','strategist','manager'].every(id=>state.agents.some(a=>a.id===id&&a.enabled!==false));
  const reserved=state.finance.usage.reduce((sum,u)=>sum+u.reservedCents,0);
  const remaining=Math.max(0,profile.apiBudgetCents-state.finance.apiSpendCents-reserved);
  const approval=state.approvals.find(a=>a.id===batch?.approvalId);
  function loadBrief(){if(brief){setForm(brief.direction);setVersion(brief.version);}draftRequest.current=null;setUnconfirmed(false);}
  async function save(){setBusy('save');try{
    const saved=await api<LaunchBrief>('/launch/brief',{version,...normalized});setForm(saved.direction);setVersion(saved.version);draftRequest.current=null;setUnconfirmed(false);
    await refresh();notify('Launch direction saved. Your team can prepare the drafts.');
  }catch(e){notify(e instanceof Error?e.message:'Could not save direction.',true);}finally{setBusy('');}}
  async function prepare(){if(!brief)return;setBusy('prepare');
    if(draftRequest.current?.version!==brief.version)draftRequest.current={version:brief.version,requestId:requestId()};
    try{await api<LaunchBatch>('/launch/drafts',draftRequest.current);draftRequest.current=null;setUnconfirmed(false);await refresh();notify('Launch drafts are in your team’s queue.');}
    catch(e){setUnconfirmed(true);notify((e instanceof Error?e.message:'Could not confirm draft request.')+' Use Retry draft request to confirm whether it started.',true);}
    finally{setBusy('');}
  }
  async function review(){if(!batch)return;setBusy('review');try{
    await api('/launch/review',{batchId:batch.id});await refresh();navigate('approvals');notify('Launch pack added to your approval queue.');
  }catch(e){notify(e instanceof Error?e.message:'Could not submit launch pack.',true);}finally{setBusy('');}}
  const canPrepare=brief&&!changed&&!stale&&!state.paused&&connected&&agentsReady&&profile.currency==='USD'&&(!active||unconfirmed)&&(!uncertain||unconfirmed);
  return <><PageTitle eyebrow="FROM DIRECTION TO DRAFTS" title="Give your launch a shape." description="Choose the direction. Your team prepares an offer, a starter asset, and launch copy for your review."/>
    <div className="launch-summary"><div><ShieldCheck size={18}/><span><strong>{profile.weeklyHours} hours / week</strong>Confirmed owner time for ideas and review</span></div><div><Sparkles size={18}/><span><strong>{money(remaining,profile.currency)} API budget remaining</strong>After recorded usage and current reservations</span></div></div>
    <div className="launch-layout"><form className="panel launch-direction" onSubmit={e=>{e.preventDefault();void save();}}>
      <fieldset disabled={Boolean(busy)}><legend>1. Set the direction</legend><p>Your choices guide this launch. Saving them does not start a paid task.</p>
        <label htmlFor="launch-audience">Who is it for?</label><input id="launch-audience" required maxLength={500} value={form.audience} onChange={e=>setForm({...form,audience:e.target.value})} placeholder="Describe one audience and the problem they face"/>
        <label htmlFor="launch-transformation">What change will the offer help them make?</label><textarea id="launch-transformation" required maxLength={1500} rows={4} value={form.transformation} onChange={e=>setForm({...form,transformation:e.target.value})}/>
        <div className="form-grid"><div><label htmlFor="launch-format">First offer format</label><select id="launch-format" required value={form.format} onChange={e=>setForm({...form,format:e.target.value as DirectionForm['format']})}><option value="">Choose a format</option><option value="toolkit">Templates & toolkit</option><option value="guide">Digital guide</option><option value="audit">Automation audit</option><option value="coaching">Coaching outline</option></select></div><div><label htmlFor="launch-channel">Content preference</label><select id="launch-channel" required value={form.channel} onChange={e=>setForm({...form,channel:e.target.value as DirectionForm['channel']})}><option value="">Choose a channel</option><option value="text">Text</option><option value="video">Video</option><option value="both">Text & video</option></select></div></div>
        {stale&&<p className="launch-warning">A newer direction was saved. Load it before editing again.</p>}
        <div className="launch-form-actions"><Button type="submit" variant="primary" disabled={Boolean(busy)||stale||!changed}>{busy==='save'?<Spinner/>:<Save size={15}/>}Save direction</Button>{brief&&(changed||stale)&&<Button onClick={loadBrief}>Load saved direction</Button>}</div>
        {brief&&<p className="launch-saved"><CheckCircle2 size={13}/>Saved direction v{brief.version} · {shortDate(brief.updatedAt)}</p>}
      </fieldset>
    </form><section className="panel launch-work" aria-labelledby="launch-work-heading"><div className="panel-heading"><div><h2 id="launch-work-heading">2. Let the team draft</h2><p>Three stages, with work passed between agents.</p></div><FileText size={20}/></div>
      <ol className="launch-stages">{(batch?.stages??[{id:'offer',title:'Offer brief',agentId:'research',job:null},{id:'asset',title:'Starter asset',agentId:'strategist',job:null},{id:'copy',title:'Landing page & emails',agentId:'manager',job:null}]).map((stage,i)=><li key={stage.id}><span className="launch-stage-number">{i+1}</span><div><h3>{stage.title}</h3><p>{state.agents.find(a=>a.id===stage.agentId)?.name}</p>{stage.job&&<Badge tone={stage.job.status==='completed'?'green':['blocked','failed'].includes(stage.job.status)?'orange':'neutral'}>{stage.job.status}</Badge>}</div>{stage.job&&<Button onClick={()=>viewJob(stage.job!)}>{stage.job.result?'View draft':stage.job.error?'View issue':'View task'}<ArrowRight size={13}/></Button>}</li>)}</ol>
      <div className="launch-controls">
        {batch?.outdated&&<p className="launch-warning">This pack uses an earlier direction or owner constraints. Prepare fresh drafts before review.</p>}
        {changed&&<p>Save your direction before requesting drafts.</p>}
        {state.paused&&<p>Your team is paused. Resume it to start work.</p>}
        {!connected&&<p>Connect and enable a model provider in Settings.</p>}
        {!agentsReady&&<p>Enable Research, Content Strategist and Manager in Settings.</p>}
        {profile.currency!=='USD'&&<p>Cloud requests currently require a USD budget.</p>}
        {uncertain&&<p className="launch-warning">A request has uncertain billing. Check the provider invoice and reconcile it in Finance before preparing another pack. <button className="text-link" onClick={()=>navigate('finance')}>Open Finance<ArrowRight size={13}/></button></p>}
        {active&&<p role="status">Your team is preparing this pack. Each stage waits for the previous draft.</p>}
        {batch&&!active&&!complete&&!batch.outdated&&!uncertain&&<p>A stage needs attention. Open its issue before requesting a fresh pack.</p>}
        <Button variant={complete&&!batch?.outdated?'':'primary'} onClick={()=>void prepare()} disabled={Boolean(busy)||!canPrepare}>{busy==='prepare'?<Spinner/>:<Sparkles size={15}/ >}{unconfirmed?'Retry draft request':batch?'Prepare fresh drafts':'Prepare launch drafts'}</Button>
        <p className="launch-cost-note">Up to three AI requests use your API budget. Each request checks the API, operating and hard limits before dispatch. Uncertain paid requests are held for review.</p>
      </div>
    </section></div>
    <section className="panel launch-review"><div className="step-icon sage"><Layers3 size={22}/></div><div><h2>3. Review in one place</h2><p>{batch?.approvalId?`This pack is in Approvals${approval?` · ${approval.status}`:''}.`:'When all three drafts complete, send the exact pack to your approval queue.'}</p><p>Publishing, email, bookings, checkout and delivery need connected adapters and a separate review of the actual action.</p></div>{batch?.approvalId?<Button onClick={()=>navigate('approvals')}>Open Approvals<ArrowRight size={15}/></Button>:<Button variant="primary" onClick={()=>void review()} disabled={Boolean(busy)||!complete||batch?.outdated||changed||stale}>{busy==='review'?<Spinner/>:<ShieldCheck size={15}/>}Send pack to Approvals</Button>}</section>
    <ShopifyWorkspace state={state} refresh={refresh} notify={notify} viewJob={viewJob} navigate={navigate}/>
  </>;
}
