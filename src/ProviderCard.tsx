import {useState} from 'react';
import {Check,KeyRound,LockKeyhole,Settings2,Unplug} from 'lucide-react';
import {api} from './api';
import {Badge,Button,Spinner} from './components';
import type {HubState,Provider} from './types';

type Props={provider:Provider;state:HubState;refresh:()=>Promise<void>;notify:(text:string,error?:boolean)=>void};

export default function ProviderCard({provider,state,refresh,notify}:Props){
  const [key,setKey]=useState('');
  const [config,setConfig]=useState(provider);
  const [advanced,setAdvanced]=useState(false);
  const [busy,setBusy]=useState(false);
  const [models,setModels]=useState<string[]|null>(null);
  const [selectionNotice,setSelectionNotice]=useState('');
  const kimi=provider.id==='moonshot';
  const retiredKimi=kimi&&[config.model,config.premiumModel].includes('kimi-k2.5');

  async function save(disconnect=false){
    setBusy(true);
    try{
      await api('/providers/'+provider.id,{
        enabled:!disconnect,model:config.model,premiumModel:config.premiumModel,
        inputPerMillion:config.inputPerMillion,outputPerMillion:config.outputPerMillion,
        premiumInputPerMillion:config.premiumInputPerMillion,premiumOutputPerMillion:config.premiumOutputPerMillion,
        ...(disconnect?{key:''}:key?{key}:{}),
      });
      if(key||disconnect)setModels(null);
      setKey('');setSelectionNotice('');await refresh();
      notify(disconnect?'Provider disconnected.':'Provider settings saved. Run a draft task to test model access.');
    }catch(error){notify(error instanceof Error?error.message:'Could not save provider.',true);}
    finally{setBusy(false);}
  }

  async function checkModels(){
    setBusy(true);
    try{
      const result=await api<{models:string[]}>('/providers/'+provider.id+'/models',{});
      setModels(result.models);setAdvanced(true);
    }catch(error){notify(error instanceof Error?error.message:'Could not check available models.',true);}
    finally{setBusy(false);}
  }

  function useCurrentKimi(){
    setConfig(c=>({...c,model:'kimi-k2.6',premiumModel:'kimi-k2.6',inputPerMillion:.95,outputPerMillion:4,premiumInputPerMillion:.95,premiumOutputPerMillion:4}));
    setAdvanced(true);
    setSelectionNotice('Kimi K2.6 selected at $0.95 input and $4.00 output per million tokens for both tiers. Save provider to apply.');
  }

  function modelInput(field:'model'|'premiumModel',label:string){
    const id=provider.id+'-'+field;
    const value=config[field];
    return <div><label htmlFor={id}>{label}</label>{models===null?
      <input id={id} value={value} required onChange={e=>{setSelectionNotice('');setConfig(c=>({...c,[field]:e.target.value}));}}/>:
      <select id={id} value={value} required onChange={e=>{setSelectionNotice('');setConfig(c=>({...c,[field]:e.target.value}));}}>
        {!models.includes(value)&&<option value={value}>{value} · not in returned list</option>}
        {models.map(model=><option key={model} value={model}>{model}</option>)}
      </select>}</div>;
  }

  return <section className="panel provider-card">
    <div className="provider-top">
      <div className={`provider-logo ${provider.id}`}>{provider.id==='openai'?'O':provider.id==='anthropic'?'A':'K'}</div>
      <div><h2>{provider.name}</h2><p>{provider.id==='openai'?'Responses API':provider.id==='anthropic'?'Messages API · prompt caching':'Moonshot API · token billing'}</p></div>
      <Badge tone={provider.connected?'green':'neutral'}>{provider.connected?provider.verifiedAt?'Tested by request':'Key saved':'Not connected'}</Badge>
    </div>
    <form onSubmit={e=>{e.preventDefault();void save();}}>
      <label htmlFor={'key-'+provider.id}>API key</label>
      <div className="password-wrap"><KeyRound size={15}/><input id={'key-'+provider.id} type="password" value={key} autoComplete="new-password" spellCheck={false} placeholder={provider.connected?'A key is saved. Enter a new one to replace it.':'Paste your developer API key'} onChange={e=>setKey(e.target.value)}/></div>
      <div className="provider-storage"><LockKeyhole size={12}/>{state.vaultPersistent?'Encrypted using your operating system.':'Session only. Close the service to clear keys.'}</div>
      {kimi&&<div className="provider-model-tools">
        {retiredKimi&&<div className="model-warning" role="alert"><p>Kimi K2.5 was discontinued. Choose a current model before starting another task.</p><Button disabled={busy} onClick={useCurrentKimi}>Use Kimi K2.6</Button></div>}
        <Button disabled={busy||!provider.connected||Boolean(key)} onClick={()=>void checkModels()}>{busy?<Spinner/>:<Settings2 size={14}/>}Check available models</Button>
        <p className="fine-print">Uses your saved international Moonshot API key to retrieve model names. No text-generation request is made. Save a new key before checking it.</p>
        {models!==null&&<p role="status">{models.length?`${models.length} models returned. Choose routine and premium models below and confirm their token rates. Model access is tested when a draft request succeeds.`:'No models were returned for this account. Check its access in the Kimi API console.'}</p>}
        {selectionNotice&&<p role="status">{selectionNotice}</p>}
      </div>}
      <button className="text-link advanced-toggle" type="button" onClick={()=>setAdvanced(!advanced)}><Settings2 size={14}/>{advanced?'Hide model settings':'Models & token rates'}</button>
      {advanced&&<div className="provider-advanced">
        <div className="form-grid">{modelInput('model','Routine model')}{modelInput('premiumModel','Premium model')}</div>
        <div className="form-grid">{[
          {key:'inputPerMillion',label:'Routine input · $ / 1M',value:config.inputPerMillion},
          {key:'outputPerMillion',label:'Routine output · $ / 1M',value:config.outputPerMillion},
          {key:'premiumInputPerMillion',label:'Premium input · $ / 1M',value:config.premiumInputPerMillion},
          {key:'premiumOutputPerMillion',label:'Premium output · $ / 1M',value:config.premiumOutputPerMillion},
        ].map(field=><div key={field.key}><label htmlFor={provider.id+'-'+field.key}>{field.label}</label><input id={provider.id+'-'+field.key} type="number" min="0" max="1000" step=".001" required value={field.value} onChange={e=>{setSelectionNotice('');setConfig(c=>({...c,[field.key]:Number(e.target.value)}));}}/></div>)}</div>
        <p className="fine-print">Defaults are estimates. Confirm current model access and pricing with the provider. Calls reserve a conservative maximum and never retry automatically.</p>
      </div>}
      <div className="provider-actions">
        {provider.connected?<Button variant="danger-ghost" disabled={busy} onClick={()=>void save(true)}><Unplug size={14}/>Disconnect</Button>:<span className="fine-print">API billing is separate from chat subscriptions.</span>}
        <Button type="submit" variant="primary" disabled={busy||(!key&&!provider.connected)}>{busy?<Spinner/>:<Check size={15}/ >}{provider.connected?'Save provider':'Connect provider'}</Button>
      </div>
    </form>
  </section>;
}
