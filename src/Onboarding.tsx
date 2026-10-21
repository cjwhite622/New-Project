import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Compass,LockKeyhole,MessageSquare,ShieldCheck,Sparkles} from 'lucide-react';
import {api,money} from './api';
import {Logo,Spinner} from './components';
import type {HubState,OwnerProfile} from './types';

const modelOptions=[
  {id:'commerce',label:'E-commerce',detail:'Physical products and dropshipping'},
  {id:'services',label:'Coaching & services',detail:'Your knowledge, delivered personally'},
  {id:'digital',label:'Digital products',detail:'Guides, courses and useful downloads'},
  {id:'content',label:'Content business',detail:'Writing, newsletters and an audience'},
  {id:'agency',label:'Agency',detail:'A service business built for clients'},
  {id:'existing',label:'Existing business',detail:'Keep your tools and automate around them'},
];
const stages=[{id:'existing',label:'I already run a business',detail:'Build around what is working.'},{id:'chosen',label:'I have an idea',detail:'Turn a direction into a working plan.'},{id:'recommend',label:'Help me find a direction',detail:'Compare models and choose one together.'}];
export default function Onboarding({state,onComplete,notify}:{state:HubState;onComplete:()=>Promise<void>;notify:(text:string,error?:boolean)=>void}){
  const [step,setStep]=useState(state.interview.step);const [answers,setAnswers]=useState(state.interview.answers);
  const [busy,setBusy]=useState(false);
  const value=(key:string,fallback='')=>String(answers[key]??fallback);
  const update=(key:string,input:string)=>setAnswers(current=>({...current,[key]:input}));
  useEffect(()=>{const timer=setTimeout(()=>{void api('/interview',{step,answers}).catch(()=>{});},700);return()=>clearTimeout(timer);},[step,answers]);
  const section=step<6?0:step<10?1:2;
  const name=value('name')||'there';
  const questions=[
    "First, what should we call you?",
    `Good to meet you, ${name}. Where are you starting?`,
    'What would you like this business to make possible?',
    'How much time do you want to give it?',
    'Let’s give your team clear spending limits.',
    'A little context helps us plan responsibly.',
    'Tell me about your business.',
    value('stage')==='recommend'?'Here are a few paths to consider.':'Which model fits your business?',
    value('stage')==='existing'?'What is working, and what needs help?':'What do you want to offer?',
    'What should your brand feel like?',
    `Here’s the plan, ${name}.`,
  ];
  const descriptions=[
    'I’m your Manager. We’ll get to know you, shape your business, and set the boundaries your team will work within.',
    'No particular experience is required. We’ll adapt the explanations and the first steps to you.',
    'Think about both the income you want and the life you want around it. These are goals, not promised results.',
    'Your role is to review decisions and share ideas. We’ll use this to plan a manageable approval digest.',
    'These are ceilings, not spending targets. Cloud tasks are checked against them before each request.',
    'We’ll record your risk preference and location. Tax reserves will be provisional until a qualified professional confirms them.',
    'The Hub adapts to the business you choose. Existing businesses keep their current tools and workflows.',
    value('stage')==='recommend'?'Services can start with existing skills but take delivery time. Digital products have low delivery costs but need validation. Content often needs longer to grow. Choose the model you want to explore; your team won’t choose for you.':'This selects your team’s operating playbook. You can edit it later without repeating the interview.',
    'Describe your audience, what you sell or want to sell, and what you already have. For an existing business, include your tools and the first thing to automate.',
    'You can refine the mission, voice and brand rules in your Brand Bible after setup.',
    'Review the details before the team activates. You can change your profile and limits later in Settings.',
  ];
  async function next(e:React.FormEvent){
    e.preventDefault();setBusy(true);
    try{
      if(step===4){const a=Number(value('apiBudget','50')),o=Number(value('operatingBudget','300')),h=Number(value('hardCap','500'));if(a>o||o>h)throw new Error('Keep your API budget inside the operating budget, and the operating budget inside the hard ceiling.');}
      if(step===6&&!value('stage'))throw new Error('Choose where you are starting.');
      if(step===7&&!value('model'))throw new Error('Choose the business model you want to explore.');
      if(step<10){await api('/interview',{step:step+1,answers});setStep(step+1);}
      else{
        const model=value('model');const stage=value('stage');const currency=value('currency','USD');const risk=value('risk','balanced');const tone=value('tone','casual');
        if(!['commerce','services','content','digital','agency','existing'].includes(model)||!['existing','chosen','recommend'].includes(stage))throw new Error('Review your business choices.');
        const profile:OwnerProfile={
          name:value('name'),experience:value('experience','Just starting'),goals:value('goals'),incomeTargetCents:Math.round(Number(value('incomeTarget','3000'))*100),timeline:value('timeline','12 months'),weeklyHours:Number(value('weeklyHours','3')),
          startupBudgetCents:Math.round(Number(value('startupBudget','500'))*100),operatingBudgetCents:Math.round(Number(value('operatingBudget','300'))*100),apiBudgetCents:Math.round(Number(value('apiBudget','50'))*100),hardCapCents:Math.round(Number(value('hardCap','500'))*100),
          risk:risk==='aggressive'?'aggressive':risk==='conservative'?'conservative':'balanced',jurisdiction:value('jurisdiction'),currency:currency==='GBP'?'GBP':currency==='EUR'?'EUR':currency==='CAD'?'CAD':currency==='AUD'?'AUD':'USD',
          stage:stage==='existing'?'existing':stage==='recommend'?'recommend':'chosen',model:model==='commerce'?'commerce':model==='services'?'services':model==='content'?'content':model==='agency'?'agency':model==='existing'?'existing':'digital',
          offer:value('offer'),assets:value('assets'),brand:value('brand'),tone:tone==='professional'?'professional':'casual',confirmed:true,
        };
        await api('/profile',profile);await onComplete();
      }
    }catch(error){notify(error instanceof Error?error.message:'Could not save your answer.',true);}finally{setBusy(false);}
  }
  const input=(key:string,placeholder:string,type='text',fallback='',extra:React.InputHTMLAttributes<HTMLInputElement>={})=><input id={key} name={key} type={type} value={value(key,fallback)} onChange={e=>update(key,e.target.value)} placeholder={placeholder} required autoComplete="off" {...extra}/>;
  const choices=(key:string,options:{id:string;label:string;detail:string}[])=><div className={`choice-grid ${key==='model'?'two':''}`}>{options.map(option=><button type="button" key={option.id} className={`choice ${value(key)===option.id?'selected':''}`} onClick={()=>update(key,option.id)}><div><strong>{option.label}</strong><p>{option.detail}</p></div><span className="choice-radio">{value(key)===option.id&&<Check size={12}/>}</span></button>)}</div>;
  return <main className="onboarding"><aside className="onboarding-story"><Logo/><div className="story-content"><span className="story-kicker"><span/>YOUR NEXT CHAPTER</span><h1>A business that<br/>works <em>with you.</em></h1><p>One workspace. A team with a shared purpose.<br/>More room for the life you want.</p><div className="orbit-art" aria-hidden="true"><div className="orbit-ring one"/><div className="orbit-ring two"/><div className="orbit-ring three"/><div className="orbit-core"><span className="hub-symbol"><i/><i/><i/><i/></span></div><div className="orbit-node node-one"><Compass size={21}/></div><div className="orbit-node node-two"><MessageSquare size={20}/></div><div className="orbit-node node-three"><ShieldCheck size={22}/></div><div className="orbit-node node-four"><Sparkles size={19}/></div></div></div><div className="story-footer"><LockKeyhole size={14}/><span>Your data lives on your device.</span><span className="story-version">THE HUB / 01</span></div></aside>
    <section className="interview-panel"><div className="interview-top"><span>LET’S BUILD YOUR TEAM</span><span>{String(step+1).padStart(2,'0')} <span className="muted">/ 11</span></span></div><div className="interview-progress"><i style={{width:`${(step+1)/11*100}%`}}/></div><nav className="interview-sections">{['The human','The business','Your plan'].map((s,i)=><span key={s} className={i===section?'active':i<section?'done':''}>{i<section?<CheckCircle2 size={14}/>:<b>0{i+1}</b>}{s}</span>)}</nav>
      <form className="interview-form" onSubmit={next}><div className="manager-intro"><div className="avatar manager">M</div><span>YOUR MANAGER<span>Let’s get to know you</span></span></div><h2>{questions[step]}</h2><p className="question-detail">{descriptions[step]}</p><div className="answer-fields" key={step}>
        {step===0&&<><label htmlFor="name">Your name or nickname</label>{input('name','e.g. Alex','text','',{maxLength:80,autoFocus:true})}<div className="field-note">Whatever you feel most comfortable with.</div></>}
        {step===1&&choices('experience',[{id:'Just starting',label:'I’m starting fresh',detail:'Explain the essentials as we go.'},{id:'Some experience',label:'I’ve tried a few things',detail:'I know the basics and want a system.'},{id:'Experienced',label:'I already know my way around',detail:'Keep it direct and focus on decisions.'}])}
        {step===2&&<><label htmlFor="goals">What are you working toward?</label><textarea id="goals" value={value('goals')} onChange={e=>update('goals',e.target.value)} placeholder="More independence, time with family, a business of my own…" required rows={3}/><div className="form-grid"><div><label htmlFor="incomeTarget">Monthly income goal</label>{input('incomeTarget','3000','number','3000',{min:0,max:10000000})}</div><div><label htmlFor="timeline">Your timeline</label>{input('timeline','e.g. 12 months','text','12 months')}</div></div></>}
        {step===3&&<><label htmlFor="weeklyHours">Hours per week, for reviews and ideas</label>{input('weeklyHours','3','number','3',{min:.25,max:80,step:.25})}<div className="info-panel"><ShieldCheck size={20}/><span>Less time means fewer, more concentrated decisions. It never silently grants permission to spend or publish.</span></div></>}
        {step===4&&<><label htmlFor="currency">Budget currency</label><select id="currency" value={value('currency','USD')} onChange={e=>update('currency',e.target.value)}>{['USD','GBP','EUR','CAD','AUD'].map(c=><option key={c}>{c}</option>)}</select><div className="form-grid">{[['startupBudget','Startup budget','500'],['operatingBudget','Monthly operating budget','300'],['apiBudget','Monthly API limit','50'],['hardCap','Hard monthly ceiling','500']].map(([key,label,defaultValue])=><div key={key}><label htmlFor={key}>{label}</label>{input(key,defaultValue,'number',defaultValue,{min:0,max:10000000,step:.01})}</div>)}</div><div className="field-note">API costs count toward your operating budget. All costs count toward the hard ceiling. You can start with zero.</div></>}
        {step===5&&<><label htmlFor="risk">Your risk preference</label><select id="risk" value={value('risk','balanced')} onChange={e=>update('risk',e.target.value)}><option value="conservative">Conservative · protect capital</option><option value="balanced">Balanced · measured experiments</option><option value="aggressive">Aggressive · higher uncertainty</option></select><label htmlFor="jurisdiction">Country and state or region</label>{input('jurisdiction','e.g. United States, California')}<div className="field-note">Investments always need a separate approval. The high-risk allocation starts at zero.</div></>}
        {step===6&&choices('stage',stages)}
        {step===7&&choices('model',value('stage')==='recommend'?modelOptions.filter(o=>['services','digital','content'].includes(o.id)):modelOptions)}
        {step===8&&<><label htmlFor="offer">Your offer, audience and first priority</label><textarea id="offer" required rows={4} value={value('offer')} onChange={e=>update('offer',e.target.value)} placeholder="Who you help, what you sell, and what you would like your team to handle first…"/><label htmlFor="assets">Skills, assets and tools you already have</label><textarea id="assets" rows={2} value={value('assets')} onChange={e=>update('assets',e.target.value)} placeholder="Skills, audience, content, current platforms, revenue and costs…"/></>}
        {step===9&&<><label htmlFor="brand">Business or working brand name</label>{input('brand','A name to start with','text','',{maxLength:150})}<label htmlFor="tone">How should we talk with you?</label><select id="tone" value={value('tone','casual')} onChange={e=>update('tone',e.target.value)}><option value="casual">Warm and casual</option><option value="professional">Clear and professional</option></select></>}
        {step===10&&<div className="confirmation"><div className="confirmation-row"><span>Your direction</span><strong>{modelOptions.find(m=>m.id===value('model'))?.label}</strong></div><div className="confirmation-row"><span>Your brand</span><strong>{value('brand')}</strong></div><div className="confirmation-row"><span>Your time</span><strong>{value('weeklyHours','3')} hours / week</strong></div><div className="confirmation-row"><span>Monthly operating limit</span><strong>{money(Number(value('operatingBudget','300'))*100,value('currency','USD'))}</strong></div><div className="confirmation-row"><span>API limit / hard ceiling</span><strong>{money(Number(value('apiBudget','50'))*100,value('currency','USD'))} / {money(Number(value('hardCap','500'))*100,value('currency','USD'))}</strong></div><div className="confirmation-note"><CheckCircle2 size={19}/><span>Your team starts with local planning and money tracking. Next, connect model providers when you want cloud-assisted drafts. Public actions remain subject to review and connected tools.</span></div></div>}
      </div><div className="interview-actions">{step>0?<button type="button" className="back-link" disabled={busy} onClick={()=>setStep(s=>s-1)}><ArrowLeft size={16}/>Back</button>:<span className="save-note">You can pause and come back.</span>}<button className="button primary" type="submit" disabled={busy}>{busy?<Spinner/>:step===10?'Confirm & meet my team':'Continue'}<ArrowRight size={16}/></button></div><div className="interview-bottom"><LockKeyhole size={12}/> Saved privately on this device. No paid calls during setup.</div></form>
    </section></main>;
}
