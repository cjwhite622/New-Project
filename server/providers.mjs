import { HubError } from './validation.mjs';

export const DEFAULT_PROVIDERS=[
  {id:'openai',name:'OpenAI',enabled:false,model:'gpt-4.1-mini',premiumModel:'gpt-4.1',inputPerMillion:.40,outputPerMillion:1.60,premiumInputPerMillion:2,premiumOutputPerMillion:8},
  {id:'anthropic',name:'Anthropic',enabled:false,model:'claude-haiku-4-5',premiumModel:'claude-sonnet-4-5',inputPerMillion:1,outputPerMillion:5,premiumInputPerMillion:3,premiumOutputPerMillion:15},
  {id:'moonshot',name:'Kimi / Moonshot',enabled:false,model:'kimi-k2.5',premiumModel:'kimi-k2.5',inputPerMillion:.60,outputPerMillion:3,premiumInputPerMillion:.60,premiumOutputPerMillion:3},
];
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
    body={model,max_tokens:maxOutputTokens,messages:[{role:'system',content:system},{role:'user',content:prompt}],thinking:{type:'disabled'}};
  }
  const response=await fetchImpl(url,{method:'POST',headers,body:JSON.stringify(body),signal});
  if(!response.ok)throw new HubError(`${provider.name} returned HTTP ${response.status}. Check the key, model access, and account billing. No paid request was retried.`,502);
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
