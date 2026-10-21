let session=sessionStorage.getItem('hub-session');
export async function connect(){
  const hash=new URLSearchParams(location.hash.slice(1));
  if(hash.has('session')){session=hash.get('session');sessionStorage.setItem('hub-session',session||'');history.replaceState(null,'',location.pathname);}
  if(!session){const res=await fetch('/api/session',{headers:{'x-hub-bootstrap':'1'}});if(!res.ok)throw new Error('Open The Hub desktop app or start the local development service.');const data:unknown=await res.json();if(typeof data!=='object'||data===null||!('token'in data)||typeof data.token!=='string')throw new Error('Invalid local session.');session=data.token;sessionStorage.setItem('hub-session',session);}
}
export async function api<T>(path:string,body?:unknown):Promise<T>{
  const res=await fetch('/api'+path,{method:body===undefined?'GET':'POST',headers:{authorization:`Bearer ${session}`,...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  if(!res.ok){let message='The request could not complete.';try{const error:unknown=await res.json();if(typeof error==='object'&&error!==null&&'error'in error&&typeof error.error==='string')message=error.error;}catch{/* The service may be restarting. */}throw new Error(message);}
  return res.json();
}
export async function download(path:string,filename:string){
  const data=await api<unknown>(path);const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}
export const requestId=()=>crypto.randomUUID();
export const money=(cents:number,currency='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:2}).format(cents/100);
export const shortDate=(s:string)=>new Date(s).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
