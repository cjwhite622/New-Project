import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowRight,Bot,Copy,MessageSquare,Plus,Send,ShieldCheck} from 'lucide-react';
import {api,APIError,money,requestId,shortDate} from './api';
import {Badge,Button,PageTitle,Spinner} from './components';
import type {Approval,ChatConversation,ChatSummary,HubState} from './types';

type Delivery={conversationId?:string;agentId:string;content:string;requestId:string};
type Props={state:HubState;refresh:()=>Promise<void>;notify:(text:string,error?:boolean)=>void;navigate:(page:string)=>void};

export default function Chat({state,refresh,notify,navigate}:Props){
  const [rows,setRows]=useState<ChatSummary[]>([]);const [conversation,setConversation]=useState<ChatConversation|null>(null);
  const [agentId,setAgentId]=useState('manager');const [drafts,setDrafts]=useState<Record<string,string>>({});const [filter,setFilter]=useState('');
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState('');const [loadError,setLoadError]=useState('');const [deliveryError,setDeliveryError]=useState('');const [unconfirmed,setUnconfirmed]=useState(false);const [newReply,setNewReply]=useState(false);
  const selection=useRef(0);const initialized=useRef(false);const pending=useRef<Delivery|null>(null);const messages=useRef<HTMLDivElement>(null);const stickToEnd=useRef(true);const composer=useRef<HTMLTextAreaElement>(null);
  const draftKey=conversation?.id??'new:'+agentId;const draft=drafts[draftKey]??'';
  const agent=state.agents.find(a=>a.id===(conversation?.agentId??agentId));
  const active=conversation?.turns.some(t=>t.job&&['queued','running'].includes(t.job.status))??false;
  const unknown=conversation?.turns.some(t=>state.unknownUsage.some(u=>u.jobId===t.jobId))??false;
  const connected=state.providers.some(p=>p.enabled&&p.connected);
  const unavailable=agent?.enabled===false;
  const canSend=Boolean(draft.trim())&&!loading&&!busy&&!unconfirmed&&!active&&!unknown&&!state.paused&&connected&&!unavailable;

  const loadRows=useCallback(async()=>{const summaries=await api<ChatSummary[]>('/chats');setRows(summaries);return summaries;},[]);
  useEffect(()=>{
    let cancelled=false;
    void loadRows().then(async summaries=>{
      if(cancelled||initialized.current)return;initialized.current=true;
      if(summaries[0]){const current=selection.current;const c=await api<ChatConversation>('/chats/'+encodeURIComponent(summaries[0].id));if(!cancelled&&selection.current===current){setConversation(c);setAgentId(c.agentId);}}
    }).catch(e=>{if(!cancelled)setLoadError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[loadRows]);
  useEffect(()=>{if(initialized.current)void loadRows().catch(e=>setLoadError(e.message));},[state.jobs,loadRows]);
  useEffect(()=>{
    if(!conversation?.id||!active||loading)return;const id=conversation.id;const generation=selection.current;let cancelled=false,inflight=false;
    const timer=setInterval(()=>{
      if(inflight)return;inflight=true;
      void api<ChatConversation>('/chats/'+encodeURIComponent(id)).then(c=>{
        if(cancelled||selection.current!==generation)return;setConversation(c);setLoadError('');
        if(!c.turns.some(t=>t.job&&['queued','running'].includes(t.job.status)))void refresh().catch(e=>setLoadError(e.message));
      }).catch(e=>{if(!cancelled)setLoadError(e.message);}).finally(()=>{inflight=false;});
    },1200);
    return()=>{cancelled=true;clearInterval(timer);};
  },[conversation?.id,active,loading,refresh]);
  const replySignature=conversation?.turns.map(t=>t.id+':'+t.job?.status).join('|');
  useEffect(()=>{if(!messages.current)return;if(stickToEnd.current){messages.current.scrollTop=messages.current.scrollHeight;setNewReply(false);}else if(conversation?.turns.at(-1)?.job?.status==='completed')setNewReply(true);},[conversation?.id,replySignature,conversation?.turns]);

  async function openConversation(id:string){
    if(busy||unconfirmed)return;const generation=++selection.current;setLoading(true);setLoadError('');
    try{const c=await api<ChatConversation>('/chats/'+encodeURIComponent(id));if(selection.current===generation){stickToEnd.current=true;setConversation(c);setAgentId(c.agentId);setDeliveryError('');}}
    catch(e){if(selection.current===generation)setLoadError(e instanceof Error?e.message:'Could not load the conversation.');}
    finally{if(selection.current===generation)setLoading(false);}
  }
  function newConversation(){if(busy||unconfirmed)return;selection.current++;initialized.current=true;stickToEnd.current=true;setConversation(null);setLoading(false);setAgentId('manager');setLoadError('');setDeliveryError('');setNewReply(false);composer.current?.focus();}
  async function send(){
    if(loading||busy||(!unconfirmed&&!canSend))return;setBusy('send');setDeliveryError('');
    if(!pending.current)pending.current={...(conversation?{conversationId:conversation.id}:{}),agentId:conversation?.agentId??agentId,content:draft.trim(),requestId:requestId()};
    const payload=pending.current;const sentDraftKey=draftKey;
    try{
      const c=await api<ChatConversation>('/chat/messages',payload);selection.current++;initialized.current=true;stickToEnd.current=true;setConversation(c);setAgentId(c.agentId);setDrafts(current=>({...current,[sentDraftKey]:''}));pending.current=null;setUnconfirmed(false);await refresh().catch(e=>setLoadError(e.message));await loadRows().catch(e=>setLoadError(e.message));composer.current?.focus();
    }catch(e){
      const rejected=e instanceof APIError&&[400,401,403,404,409,413].includes(e.status);
      if(rejected){pending.current=null;setUnconfirmed(false);}else setUnconfirmed(true);
      setDeliveryError(e instanceof Error?e.message:'Could not confirm message delivery.');
    }finally{setBusy('');}
  }
  async function review(turnId:string){if(!conversation)return;setBusy(turnId);try{await api<Approval>('/chat/review',{conversationId:conversation.id,turnId});await refresh();notify('The exact reply is in Approvals. No external action was executed.');navigate('approvals');}catch(e){notify(e instanceof Error?e.message:'Could not submit the reply.',true);}finally{setBusy('');}}
  const visibleRows=rows.filter(c=>c.title.toLowerCase().includes(filter.toLowerCase()));
  return <><PageTitle eyebrow="IDEAS, CONTEXT, NEXT STEPS" title="A conversation with your team." description="Ask a question, work through an idea, and keep the thread. Your team remembers the recent conversation."/>
    <div className="chat-workspace panel"><aside className="chat-history" aria-label="Saved conversations"><div className="chat-history-heading"><h2>Conversations</h2><button className="icon-button" aria-label="New conversation" disabled={Boolean(busy)||unconfirmed} onClick={newConversation}><Plus size={18}/></button></div><label className="sr-only" htmlFor="chat-search">Find a conversation</label><input id="chat-search" type="search" placeholder="Find a conversation…" value={filter} onChange={e=>setFilter(e.target.value)}/><div className="chat-history-list">{visibleRows.length?visibleRows.map(c=><button key={c.id} aria-current={conversation?.id===c.id?'true':undefined} disabled={Boolean(busy)||unconfirmed} className={conversation?.id===c.id?'selected':''} onClick={()=>void openConversation(c.id)}><MessageSquare size={15}/><span><strong>{c.title}</strong><small>{state.agents.find(a=>a.id===c.agentId)?.name} · {shortDate(c.updatedAt)}</small>{['queued','running'].includes(c.status)&&<small>Reply in progress</small>}</span></button>):<p className="chat-history-empty">{filter?'No matching conversations.':'Your conversations will appear here.'}</p>}</div><p className="chat-history-note"><ShieldCheck size={14}/>Saved on this device. Separate from your private personal journal.</p></aside>
      <section className="chat-conversation" aria-label="Team conversation"><header className="chat-header"><div className="chat-agent-avatar"><Bot size={20}/></div><div><label htmlFor="chat-agent">Talk to</label><select id="chat-agent" value={conversation?.agentId??agentId} disabled={Boolean(conversation)||Boolean(busy)||unconfirmed} onChange={e=>setAgentId(e.target.value)}>{state.agents.filter(a=>a.department!=='personal').map(a=><option key={a.id} value={a.id} disabled={a.enabled===false}>{a.name}{a.enabled===false?' · disabled':''}</option>)}</select></div><Badge tone={active?'orange':'neutral'}>{active?'Working on a reply':'Private business chat'}</Badge></header>
        {loadError&&<div className="chat-error" role="alert">{loadError}<Button onClick={()=>conversation?void openConversation(conversation.id):void loadRows().then(()=>setLoadError('')).catch(e=>setLoadError(e.message))}>Reload conversation</Button></div>}
        <div className="chat-messages" ref={messages} role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions text" onScroll={()=>{const el=messages.current;if(el){stickToEnd.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;if(stickToEnd.current)setNewReply(false);}}}>
          {loading?<div className="chat-loading"><Spinner/><span>Opening conversations…</span></div>:!conversation?<div className="chat-welcome"><div className="chat-welcome-icon"><MessageSquare size={27}/></div><h2>What’s on your mind?</h2><p>Bring your team an idea or a decision. Start with your Manager, or choose the specialist you need.</p><div className="chat-starters">{['Help me choose the next useful step.','Review my offer and label the assumptions.','Draft a simple plan within my time and budget.'].map(prompt=><button key={prompt} onClick={()=>{setDrafts(current=>({...current,[draftKey]:prompt}));composer.current?.focus();}}>{prompt}<ArrowRight size={14}/></button>)}</div></div>:conversation.turns.map(turn=><div className="chat-turn" key={turn.id}><article className="chat-message owner"><div className="chat-message-label"><span>You</span><time dateTime={turn.createdAt}>{shortDate(turn.createdAt)}</time></div><div className="chat-message-text">{turn.content}</div></article><article className={`chat-message assistant ${turn.job?.status??'failed'}`}><div className="chat-message-label"><span><Bot size={14}/>{agent?.name??'Your team'}</span><small>{turn.job?.status==='completed'?`${money(turn.job.costCents,state.profile!.currency)} estimated${turn.job.cached?' · cached':''}`:turn.job?.status??'unavailable'}</small></div>{turn.job?.status==='completed'?<><div className="chat-message-text">{turn.job.result}</div><div className="chat-message-actions"><button onClick={()=>void navigator.clipboard.writeText(turn.job!.result??'').then(()=>notify('Reply copied.'),()=>notify('Could not copy the reply. Select and copy its text instead.',true))}><Copy size={13}/>Copy reply</button><button disabled={Boolean(busy)} onClick={()=>turn.approvalId?navigate('approvals'):void review(turn.id)}><ShieldCheck size={13}/>{turn.approvalId?'Open reply in Approvals':'Send reply to Approvals'}</button></div></>:['queued','running'].includes(turn.job?.status??'')?<div className="chat-thinking"><Spinner/><span>{turn.job?.status==='queued'?'Your message is queued.':'Your team is preparing a reply…'}</span></div>:<div className="chat-job-error"><p>{turn.job?.error??'The saved reply task is unavailable.'}</p><Button onClick={()=>navigate(state.unknownUsage.some(u=>u.jobId===turn.jobId)?'finance':'tasks')}>{state.unknownUsage.some(u=>u.jobId===turn.jobId)?'Review billing in Finance':'Open Task history'}<ArrowRight size={13}/></Button></div>}</article></div>)}
        </div>{newReply&&<button className="chat-new-reply" onClick={()=>{stickToEnd.current=true;if(messages.current)messages.current.scrollTop=messages.current.scrollHeight;setNewReply(false);}}>New reply<ArrowDown size={13}/></button>}
        <form className="chat-composer" onSubmit={e=>{e.preventDefault();void send();}}>{deliveryError&&<p className="chat-delivery-error" role="alert">{deliveryError}{unconfirmed?' Check delivery using the same message; it will not create a second request.':''}</p>}{unknown&&<p className="chat-delivery-error">This conversation needs a billing check in Finance before another message.</p>}{!connected&&<p className="chat-connection-note">Connect a model provider in Settings to get replies. Reading saved conversations is free. <button type="button" onClick={()=>navigate('settings')}>Open Settings</button></p>}{state.paused&&<p className="chat-connection-note">Your team is paused. Resume using the sidebar to send new messages.</p>}{unavailable&&<p className="chat-connection-note">This agent is disabled. Enable it in My team or start another conversation.</p>}
          <label className="sr-only" htmlFor="chat-message">Message your team</label><textarea ref={composer} id="chat-message" rows={3} maxLength={6000} value={draft} disabled={Boolean(busy)||unconfirmed||loading} onChange={e=>setDrafts(current=>({...current,[draftKey]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(canSend)void send();}}} placeholder={`Message ${agent?.name??'your team'}…`}/><div className="chat-composer-footer"><p>Enter to send · Shift+Enter for a new line<br/>Uses your connected model and budget. External actions need exact approval.</p><Button type="submit" variant="primary" disabled={unconfirmed?Boolean(busy):!canSend}>{busy==='send'?<Spinner/>:<Send size={15}/ >}{unconfirmed?'Check message delivery':'Send message'}</Button></div>
        </form>
      </section>
    </div></>;
}
