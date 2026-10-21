import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHub} from '../server/hub.mjs';
import {fixture,profile} from './helpers.mjs';

function scenario(options={}){
  const requests=[];
  const f=fixture({fetchImpl:async(url,init)=>{
    const body=JSON.parse(init.body);requests.push(body);
    if(options.fetch)return options.fetch(body,init);
    return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:`Gardening reply ${requests.length}: start with three herbs.`}]}],usage:{input_tokens:100,output_tokens:40}}));
  }});
  f.hub.saveProfile(profile);f.hub.saveProvider('openai',{enabled:true,key:'fixture-chat-key'});
  const send=(content,requestId,conversationId,agentId='manager')=>f.hub.sendChatMessage({agentId,content,requestId,...(conversationId?{conversationId}:{})});
  return {...f,requests,send};
}

test('chat saves a conversation and its completed reply across restart',async()=>{
  const f=scenario();let again;try{
    assert.equal(typeof f.hub.sendChatMessage,'function','Persistent team chat is not implemented');
    const thread=f.send('Help with a balcony herb offer','first');assert.equal(thread.turns.length,1);assert.equal(thread.turns[0].job.status,'queued');
    await f.hub.drain();const done=f.hub.chatConversation(thread.id);assert.equal(done.turns[0].job.result,'Gardening reply 1: start with three herbs.');
    assert.equal(f.hub.chatConversations().length,1);assert.equal(f.hub.finance().apiSpendCents,1);
    again=createHub({dataDir:f.dataDir});assert.equal(again.chatConversation(thread.id).turns[0].job.result,done.turns[0].job.result);
  }finally{again?.close();f.close();}
});

test('follow-ups receive only their own completed conversation history',async()=>{
  const f=scenario();try{
    const a=f.send('First balcony discussion','a');await f.hub.drain();
    const other=f.send('Separate private business discussion','b');await f.hub.drain();
    f.send('Turn it into three next steps','follow',a.id);await f.hub.drain();
    assert.match(f.requests[2].instructions,/First balcony discussion/);assert.match(f.requests[2].instructions,/Gardening reply 1/);
    assert.doesNotMatch(f.requests[2].instructions,/Separate private business discussion|fixture-chat-key/);
    assert.equal(f.hub.chatConversation(other.id).turns.length,1);
  }finally{f.close();}
});

test('duplicate chat delivery creates one message and one paid job and rejects changed replay content',async()=>{
  const f=scenario();try{
    const a=f.send('A gardening question','same');const b=f.send('A gardening question','same');assert.equal(a.id,b.id);assert.equal(b.turns.length,1);
    assert.throws(()=>f.send('Changed content','same'),/request|different|changed/i);await f.hub.drain();assert.equal(f.requests.length,1);
    assert.equal(f.hub.jobs().length,1);assert.equal(f.hub.chatConversations().length,1);
  }finally{f.close();}
});

test('a conversation accepts no overlapping turn and keeps its selected business agent',async()=>{
  const f=scenario();try{
    const a=f.send('A private gardening question','first');assert.throws(()=>f.send('Too soon','second',a.id),/progress|wait|active/i);
    await f.hub.drain();assert.throws(()=>f.send('Change role silently','change',a.id,'strategist'),/agent|conversation/i);
    assert.throws(()=>f.send('Private notes','coach',undefined,'life-coach'),/private|personal/i);
    assert.throws(()=>f.hub.chatConversation('missing'),/not found/i);assert.equal(f.requests.length,1);
  }finally{f.close();}
});

test('an unknown chat request remains held for billing reconciliation without automatic resend',async()=>{
  const f=scenario({fetch:()=>{throw new Error('Lost response PRIVATE_ERROR');}});try{
    const a=f.send('A gardening question','lost');await f.hub.drain();assert.equal(f.hub.chatConversation(a.id).turns[0].job.status,'failed');
    assert.throws(()=>f.send('Another question','next',a.id),/billing|reconcile/i);assert.equal(f.requests.length,1);
    const usage=f.hub.unknownUsage()[0];f.hub.resolveUsage(usage.jobId,{costCents:0,inputTokens:0,outputTokens:0,note:'Provider fixture confirms no generation charge.'});
    f.send('Explicit new message after billing check','after',a.id);assert.equal(f.hub.chatConversation(a.id).turns.length,2);assert.equal(f.requests.length,1);
    assert.doesNotMatch(JSON.stringify(f.hub.chatConversation(a.id)),/PRIVATE_ERROR/);
  }finally{f.close();}
});

test('pause, missing provider and disabled agent retain a visible conversation without untracked spending',async()=>{
  const f=scenario();try{
    f.hub.setPaused(true);assert.throws(()=>f.send('Paused message','pause'),/paused/i);assert.equal(f.hub.chatConversations().length,0);
    f.hub.setPaused(false);f.hub.saveProvider('openai',{enabled:false});const a=f.send('No provider message','missing');await f.hub.drain();
    assert.equal(f.hub.chatConversation(a.id).turns[0].job.status,'blocked');assert.equal(f.requests.length,0);
    f.hub.saveAgent('manager',{enabled:false,tokenBudget:200000});assert.throws(()=>f.send('Disabled','disabled',a.id),/agent|unavailable/i);
    assert.equal(f.hub.chatConversation(a.id).turns.length,1);
  }finally{f.close();}
});

test('chat review copies the exact completed reply to one generic approval and executes no business action',async()=>{
  const f=scenario();try{
    const a=f.send('Draft a balcony offer','review');assert.throws(()=>f.hub.reviewChatReply({conversationId:a.id,turnId:a.turns[0].id}),/completed|wait/i);
    await f.hub.drain();const input={conversationId:a.id,turnId:a.turns[0].id};const card=f.hub.reviewChatReply(input);assert.equal(card.content,f.hub.chatConversation(a.id).turns[0].job.result);
    assert.equal(f.hub.reviewChatReply(input).id,card.id);assert.equal(f.hub.approvals().length,1);
    assert.equal(f.hub.decideApproval(card.id,{version:1,decision:'approve'}).execution,'connection_required');assert.equal(f.requests.length,1);
  }finally{f.close();}
});

test('chat history is bounded to recent complete turns while the full conversation remains saved',async()=>{
  const f=scenario();try{
    let a=f.send('OLDEST_CONTEXT '+ 'a'.repeat(5500),'oldest');await f.hub.drain();
    for(let i=0;i<5;i++){f.send(`Turn ${i} `+'b'.repeat(5500),'long-'+i,a.id);await f.hub.drain();}
    f.send('What is the next step?','last',a.id);await f.hub.drain();
    const system=f.requests.at(-1).instructions;assert.doesNotMatch(system,/OLDEST_CONTEXT/);assert.match(system,/Turn 4/);assert.ok(system.length<22000);
    assert.equal(f.hub.chatConversation(a.id).turns.length,7);
  }finally{f.close();}
});

test('business chat never reads personal notes or accepts forged client workflow fields',async()=>{
  const f=scenario();try{
    f.hub.personal.save({goals:'PRIVATE_COACH',notes:'PRIVATE_JOURNAL',checkIn:'On my terms'});
    assert.throws(()=>f.hub.sendChatMessage({agentId:'manager',content:'Hello',requestId:'forge',workflow:{type:'shopify-action',approvalId:'fake',approvalVersion:1}}));
    const a=f.send('A business question','safe');await f.hub.drain();
    assert.doesNotMatch(JSON.stringify(f.requests),/PRIVATE_COACH|PRIVATE_JOURNAL|fixture-chat-key/);assert.equal(f.hub.chatConversation(a.id).turns[0].job.workflow.type,'chat');
    assert.equal(f.hub.approvals().length,0);
  }finally{f.close();}
});

test('reviewing a chat reply does not copy the owner prompt into the audit trail',async()=>{
  const f=scenario();try{
    const c=f.send('CONFIDENTIAL_CHAT_PROMPT customer margins','audit');await f.hub.drain();f.hub.reviewChatReply({conversationId:c.id,turnId:c.turns[0].id});
    assert.doesNotMatch(JSON.stringify(f.hub.audit()),/CONFIDENTIAL_CHAT_PROMPT/);
  }finally{f.close();}
});

test('public job request IDs cannot substitute unrelated work for a chat reply',async()=>{
  const f=scenario();try{
    const unrelated=f.hub.enqueue({agentId:'manager',kind:'digest',requestId:'chat:collision'});await f.hub.drain();
    const c=f.send('Write a gardening welcome email','collision',undefined,'strategist');assert.notEqual(c.turns[0].job.id,unrelated.id);
    assert.equal(c.turns[0].job.agentId,'strategist');assert.equal(c.turns[0].job.workflow.type,'chat');await f.hub.drain();assert.equal(f.requests.length,1);
  }finally{f.close();}
});

test('a maximum-length chat delivery ID is accepted and remains replay-safe',async()=>{
  const f=scenario();try{
    const requestId='x'.repeat(150);const c=f.send('A gardening question',requestId);assert.equal(f.send('A gardening question',requestId).id,c.id);await f.hub.drain();assert.equal(f.requests.length,1);
  }finally{f.close();}
});
