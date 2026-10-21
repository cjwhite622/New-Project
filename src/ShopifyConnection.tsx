import {useState} from 'react';
import {CheckCircle2,KeyRound,Save,ShieldCheck} from 'lucide-react';
import {api,shortDate} from './api';
import {Badge,Button,Spinner} from './components';
import type {HubState,ShopifyConnection as ShopifyConnectionState} from './types';
type Props={state:HubState;refresh:()=>Promise<void>;notify:(text:string,error?:boolean)=>void};
export default function ShopifyConnection({state,refresh,notify}:Props){
  const c=state.shopify.connection;const [shop,setShop]=useState(c.shop);const [mode,setMode]=useState(c.mode);const [clientId,setClientId]=useState(c.clientId);const [secret,setSecret]=useState('');const [busy,setBusy]=useState('');
  const changed=shop.trim().toLowerCase()!==c.shop||mode!==c.mode||clientId!==c.clientId||Boolean(secret);
  const write=(c.scopes??[]).some(s=>['write_content','write_online_store_pages'].includes(s));
  async function run(action:string){setBusy(action);try{
    if(action==='save'){const saved=await api<ShopifyConnectionState>('/connections/shopify',{shop,mode,...(mode==='client_credentials'?{clientId,...(secret?{clientSecret:secret}:{})}:secret?{token:secret}:{})});setShop(saved.shop);setClientId(saved.clientId);setSecret('');notify('Shopify settings saved. Check the connection before reviewing a store action.');}
    else if(action==='check'){await api('/connections/shopify/check',{});notify('Shopify identity and granted scopes checked. No store content changed.');}
    else{await api('/connections/shopify/disconnect',{});setSecret('');setClientId('');notify('Shopify credentials removed from The Hub.');}
    await refresh();
  }catch(e){notify(e instanceof Error?e.message:'Could not update Shopify.',true);}finally{setBusy('');}}
  return <><div className="info-panel connection-info"><KeyRound size={21}/><div><strong>Connect your existing Shopify store.</strong><span>The connection check reads store identity and permissions. Creating an unpublished page requires a separate exact action approval.</span></div></div>
    <section className="panel shopify-connection"><div className="provider-top"><div className="provider-logo">S</div><div><h2>Shopify</h2><p>Store pages · official Admin GraphQL API</p></div><Badge tone={c.verifiedAt&&write?'green':'neutral'}>{c.verifiedAt?write?'Checked · page access':'Checked · read only':c.hasCredentials?'Saved · check needed':'Not connected'}</Badge></div>
      <form onSubmit={e=>{e.preventDefault();void run('save');}}><fieldset disabled={Boolean(busy)}><legend className="sr-only">Shopify connection settings</legend>
        <label htmlFor="shopify-shop">Permanent Shopify domain</label><input id="shopify-shop" required autoCapitalize="none" spellCheck={false} value={shop} onChange={e=>setShop(e.target.value)} placeholder="your-store.myshopify.com"/>
        <label htmlFor="shopify-mode">App authentication</label><select id="shopify-mode" value={mode} onChange={e=>{setMode(e.target.value as typeof mode);setSecret('');}}><option value="client_credentials">App client ID & secret</option><option value="token">Existing Admin API access token</option></select>
        {mode==='client_credentials'&&<><label htmlFor="shopify-client-id">Shopify app client ID</label><input id="shopify-client-id" required autoComplete="off" value={clientId} onChange={e=>setClientId(e.target.value)}/><p className="fine-print">For an installed app and store owned by the same Shopify organization. The Hub renews expiring access tokens before requests.</p></>}
        <label htmlFor="shopify-secret">{mode==='token'?'Admin API access token':'Shopify app client secret'}</label><input id="shopify-secret" type="password" autoComplete="new-password" required={!c.hasCredentials||mode!==c.mode||shop.trim().toLowerCase()!==c.shop} value={secret} onChange={e=>setSecret(e.target.value)} placeholder={c.hasCredentials?'Leave blank to keep the saved credential':'Enter in this app; never in chat'}/>
        <p className="fine-print">The installed app needs <strong>write_online_store_pages</strong> or <strong>write_content</strong> to create unpublished pages. It does not need customer, order, payment or inventory access for this adapter.</p>
        <div className="shopify-connection-actions"><Button type="submit" variant="primary" disabled={Boolean(busy)||!changed}>{busy==='save'?<Spinner/>:<Save size={15}/>}Save Shopify connection</Button><Button onClick={()=>void run('check')} disabled={Boolean(busy)||!c.hasCredentials||changed}>{busy==='check'?<Spinner/>:<CheckCircle2 size={15}/>}Check Shopify connection</Button>{c.hasCredentials&&<Button onClick={()=>void run('disconnect')} disabled={Boolean(busy)}>Disconnect Shopify</Button>}</div>
      </fieldset></form>
      {c.verifiedAt&&<p className="shopify-checked"><CheckCircle2 size={15}/>{c.name} · {c.shop} · {shortDate(c.verifiedAt)}</p>}
      <p className="provider-storage"><ShieldCheck size={13}/>{c.storage==='os-encrypted'?'Credentials encrypted by your operating system.':'Session-only credentials: reconnect after closing the app.'} Credentials are excluded from prompts, exports and browser storage.</p>
      <details className="shopify-setup"><summary>Get the Shopify app credentials</summary><p>Create an app in Shopify’s Dev Dashboard, grant page access, and install it on your own store. Use its client ID and secret here. If you already have a working Admin API token, choose that option instead.</p><Button onClick={()=>void navigator.clipboard.writeText('https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant').then(()=>notify('Official Shopify setup link copied. Open it in your browser.'),()=>notify('Could not copy the link. Find Client credentials grant in the Shopify developer documentation.',true))}>Copy official setup guide link</Button><p>Saving credentials does not change your store. Check the connection, then return to Launch to review the exact draft action.</p></details>
    </section><section className="panel integration-gate"><div><h3>Your other services</h3><p>Gmail sending, Hostinger publishing and Stripe reconciliation remain separate adapters. Shopify page access does not activate email, DNS changes, checkout or payments.</p></div><Badge>Next integrations</Badge></section>
  </>;
}
