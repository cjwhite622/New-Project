import { HubError } from './validation.mjs';

export const DEFAULT_PROVIDERS=[
  {id:'openai',name:'OpenAI',enabled:false,model:'gpt-4.1-mini',premiumModel:'gpt-4.1',inputPerMillion:.40,outputPerMillion:1.60,premiumInputPerMillion:2,premiumOutputPerMillion:8},
  {id:'anthropic',name:'Anthropic',enabled:false,model:'claude-haiku-4-5',premiumModel:'claude-sonnet-4-5',inputPerMillion:1,outputPerMillion:5,premiumInputPerMillion:3,premiumOutputPerMillion:15},
  {id:'moonshot',name:'Kimi / Moonshot',enabled:false,model:'kimi-k2.6',premiumModel:'kimi-k2.6',inputPerMillion:.95,outputPerMillion:4,premiumInputPerMillion:.95,premiumOutputPerMillion:4},
];
export class ProviderRequestError extends HubError {
  constructor(message,{rejected=false}={}){super(message,502);this.rejected=rejected;}
}
async function providerError(response,provider){
  let payload,detail;
  try{payload=await response.json();detail=payload?.error;}catch{/* Gateways may return HTML. */}
  const codes=[detail?.code,detail?.type];
  // Only documented pre-generation rejections release a billing reservation.
  // An HTTP status alone, arbitrary error text or a server failure cannot.
  const rejectionCodes={
    401:['invalid_api_key','invalid_authentication_error','incorrect_api_key_error','authentication_error'],
    403:['permission_denied_error','permission_error'],
    404:['resource_not_found_error','model_not_found','not_found_error'],
  };
  const rejected=!payload?.usage&&!payload?.output&&!payload?.choices&&!payload?.content&&codes.some(code=>rejectionCodes[response.status]?.includes(code));
  let hint='Check the provider connection, model access and account settings.';
  if(response.status===404)hint='The selected model was not found or this account cannot access it. Check both routine and premium models in Settings → Model providers.';
  else if(response.status===401)hint='The API key was not accepted. Check that the key belongs to this provider and API region.';
  else if(response.status===403)hint='This account or key does not have permission for the requested API or model.';
  else if(response.status===429){
    if(codes.some(code=>['insufficient_quota','exceeded_current_quota_error','billing_hard_limit_reached'].includes(code)))hint='The provider reports an account quota or balance limit. Check its billing and usage dashboard.';
    else if(codes.some(code=>['rate_limit_exceeded','rate_limit_reached_error','engine_overloaded_error'].includes(code)))hint='The provider reports a rate or capacity limit. Wait before creating another request.';
    else hint='The provider reports a rate or quota limit. Check its usage dashboard for the cause.';
  }
  // Never echo arbitrary provider response messages: they can contain keys or
  // request content. All displayed hints come from the fixed text above.
  return new ProviderRequestError(`${provider.name} returned HTTP ${response.status}. ${hint} No paid request was retried.`,{rejected});
}
export async function listMoonshotModels({key,fetchImpl=fetch,signal}){
  const provider=DEFAULT_PROVIDERS.find(p=>p.id==='moonshot');
  const response=await fetchImpl('https://api.moonshot.ai/v1/models',{method:'GET',headers:{authorization:`Bearer ${key}`},signal,redirect:'error'});
  if(!response.ok)throw await providerError(response,provider);
  let data;
  try{data=await response.json();}catch{throw new HubError('Kimi returned an unreadable model list. Saved settings were not changed.',502);}
  if(!Array.isArray(data?.data)||data.data.length>1000)throw new HubError('Kimi returned an invalid model list. Saved settings were not changed.',502);
  return [...new Set(data.data.map(model=>model?.id).filter(id=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/.test(id)))].sort();
}
export function memoryVault(){const keys=new Map();return {persistent:false,get:key=>keys.get(key),set:(key,value)=>value?keys.set(key,value):keys.delete(key)};}
export function estimateCost({inputTokens,outputTokens,provider,tier}){
  const input=tier===2?provider.premiumInputPerMillion:provider.inputPerMillion;
  const output=tier===2?provider.premiumOutputPerMillion:provider.outputPerMillion;
  const cacheWriteAllowance=provider.id==='anthropic'?1.25:1;
  return Math.max(1,Math.ceil((inputTokens*input*cacheWriteAllowance+outputTokens*output)/10000));
}
export async function callProvider({provider,key,system,prompt,tier,signal,fetchImpl=fetch,maxOutputTokens=1200}){
  const model=tier===2?provider.premiumModel:provider.model;
  let url,headers,body;
  if(provider.id==='anthropic'){
    url='https://api.anthropic.com/v1/messages';
    headers={'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'};
    body={model,max_tokens:maxOutputTokens,system:[{type:'text',text:system,cache_control:{type:'ephemeral'}}],messages:[{role:'user',content:prompt}]};
  }else if(provider.id==='openai'){
    url='https://api.openai.com/v1/responses';headers={authorization:`Bearer ${key}`,'content-type':'application/json'};
    body={model,instructions:system,input:prompt,max_output_tokens:maxOutputTokens,store:false};
  }else{
    url='https://api.moonshot.ai/v1/chat/completions';headers={authorization:`Bearer ${key}`,'content-type':'application/json'};
    body={model,max_tokens:maxOutputTokens,messages:[{role:'system',content:system},{role:'user',content:prompt}]};
    if(/^kimi-k2\.(5|6)(?:-|$)/.test(model))body.thinking={type:'disabled'};
    else if(/^kimi-k3(?:-|$)/.test(model))body.reasoning_effort='low';
  }
  const response=await fetchImpl(url,{method:'POST',headers,body:JSON.stringify(body),signal});
  if(!response.ok)throw await providerError(response,provider);
  const data=await response.json();
  const result=provider.id==='anthropic'?data.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n'):
    provider.id==='openai'?data.output?.flatMap(o=>o.content??[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n'):data.choices?.[0]?.message?.content;
  const rawInput=data.usage?.input_tokens??data.usage?.prompt_tokens;
  const inputTokens=provider.id==='anthropic'&&Number.isSafeInteger(rawInput)?rawInput+(data.usage?.cache_creation_input_tokens??0)+(data.usage?.cache_read_input_tokens??0):rawInput;
  const outputTokens=data.usage?.output_tokens??data.usage?.completion_tokens;
  if(!Number.isSafeInteger(inputTokens)||inputTokens<0||!Number.isSafeInteger(outputTokens)||outputTokens<0)throw new HubError('Provider returned incomplete usage. Outcome is unknown; inspect provider billing before retrying.',502);
  const stop=provider.id==='openai'?data.status:provider.id==='anthropic'?data.stop_reason:data.choices?.[0]?.finish_reason;
  const normalStops=provider.id==='openai'?['completed']:provider.id==='anthropic'?['end_turn','stop_sequence']:['stop'];
  const complete=typeof result==='string'&&Boolean(result.trim())&&(stop===undefined||normalStops.includes(stop));
  return {text:typeof result==='string'?result:'',inputTokens,outputTokens,model,complete};
}
