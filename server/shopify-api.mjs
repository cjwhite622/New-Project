import {z} from 'zod';
import {HubError,parse,text} from './validation.mjs';
import {now} from './storage.mjs';

export const SHOPIFY_VERSION='2026-10';
export const SHOP_QUERY='query HubShopifyConnection { shop { id name myshopifyDomain currencyCode } currentAppInstallation { accessScopes { handle } } }';
export const CREATE_PAGE='mutation HubCreateDraftPage($page: PageCreateInput!) { pageCreate(page: $page) { page { id title handle body isPublished } userErrors { code field message } } }';
export const FIND_PAGE='query HubFindDraftPage($query: String!) { pages(first: 10, query: $query) { nodes { id title handle body isPublished } } }';
export const CHECK_PAGE='query HubCheckDraftPage($id: ID!) { node(id: $id) { ... on Page { id title handle body isPublished } } }';
const shopSchema=z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/,'Enter the permanent store.myshopify.com domain without a URL or path.');
const pageScope=scopes=>scopes.some(scope=>['write_content','write_online_store_pages'].includes(scope));
export const canWritePages=pageScope;

export function createShopifyAPI(hub){
  const {get,set,log}=hub.store;let tokenCache=null;
  const credentials=()=>{try{return JSON.parse(hub.vault.get('business:shopify')||'null');}catch{return null;}};
  function shopifyConnection(){
    const value=get('shopify:connection');
    return {...(value??{shop:'',mode:'client_credentials',clientId:'',version:0,verifiedAt:null}),hasCredentials:Boolean(credentials()),storage:hub.vault.persistent?'os-encrypted':'session-only'};
  }
  function saveShopifyConnection(input){
    hub.requireOwner();const value=parse(z.object({shop:shopSchema,mode:z.enum(['token','client_credentials']),clientId:z.string().trim().max(250).optional(),token:text.max(10000).optional(),clientSecret:text.max(10000).optional()}).strict(),input);
    const previous=get('shopify:connection');const saved=credentials();
    const secret=value.mode==='token'?value.token:value.clientSecret;
    const nextSecret=secret??(previous?.shop===value.shop&&previous?.mode===value.mode?saved?.secret:null);
    if(!nextSecret)throw new HubError('Enter Shopify app credentials or an Admin API access token.');
    if(value.mode==='client_credentials'&&!value.clientId)throw new HubError('Enter the Shopify app client ID.');
    hub.vault.set('business:shopify',JSON.stringify({secret:nextSecret}));tokenCache=null;
    const config={shop:value.shop,mode:value.mode,clientId:value.mode==='client_credentials'?value.clientId:'',version:(previous?.version??0)+1,verifiedAt:null,scopes:[],storeId:null,name:null,currency:null};
    set('shopify:connection',config);log('owner','shopify.connection_saved',{shop:config.shop,version:config.version});return shopifyConnection();
  }
  function disconnectShopify(){hub.requireOwner();const value=get('shopify:connection');hub.vault.set('business:shopify','');tokenCache=null;set('shopify:connection',{shop:value?.shop??'',mode:value?.mode??'client_credentials',clientId:'',version:(value?.version??0)+1,verifiedAt:null,scopes:[],storeId:null,name:null,currency:null});log('owner','shopify.disconnected');return shopifyConnection();}
  async function jsonRequest(url,init){
    const response=await hub.fetchImpl(url,{...init,redirect:'error'});
    if(!response.ok)throw new HubError(response.status===401||response.status===403?'Shopify rejected the credentials or access scopes. Check the installed app and account permissions.':response.status===429?'Shopify rate limit reached. No request was automatically retried.':'Shopify could not complete the request. No request was automatically retried.',502);
    const raw=await response.text();if(raw.length>150000)throw new HubError('Shopify returned an unexpectedly large response.',502);
    try{return JSON.parse(raw);}catch{throw new HubError('Shopify returned an unreadable response.',502);}
  }
  function sameConnection(config){return get('shopify:connection')?.version===config.version&&Boolean(credentials());}
  async function shopifyToken(config,signal){
    if(!sameConnection(config))throw new HubError('Shopify connection settings changed. Check the connection again.',409);
    const secret=credentials()?.secret;if(!secret)throw new HubError('Connect Shopify in Settings first.',409);
    if(config.mode==='token')return secret;
    if(tokenCache?.version===config.version&&Date.now()<tokenCache.expiresAt-60000)return tokenCache.token;
    const result=await jsonRequest(`https://${config.shop}/admin/oauth/access_token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:config.clientId,client_secret:secret}).toString(),signal});
    if(typeof result.access_token!=='string'||!result.access_token||!Number.isFinite(result.expires_in)||result.expires_in<=0)throw new HubError('Shopify did not return a usable app token. Client credentials require an installed app and store owned by the same organization.',502);
    if(!sameConnection(config))throw new HubError('Shopify connection settings changed. Check again.',409);
    tokenCache={version:config.version,token:result.access_token,expiresAt:Date.now()+result.expires_in*1000};return tokenCache.token;
  }
  async function shopifyGraphQL(config,query,variables={},signal,beforeDispatch){
    const token=await shopifyToken(config,signal);
    if(!sameConnection(config)||signal?.aborted)throw new HubError('Shopify settings changed or the request was stopped before dispatch.',409);
    beforeDispatch?.();
    const result=await jsonRequest(`https://${config.shop}/admin/api/${SHOPIFY_VERSION}/graphql.json`,{method:'POST',headers:{'content-type':'application/json','X-Shopify-Access-Token':token},body:JSON.stringify({query,variables}),signal});
    if(Array.isArray(result.errors)&&result.errors.length)throw new HubError('Shopify rejected the operation. Check app scopes and API access. The provider error text was not copied into the app.',502);
    if(!result.data||typeof result.data!=='object')throw new HubError('Shopify did not return operation data.',502);return result.data;
  }
  async function inspectShopify(config,signal){
    const data=await shopifyGraphQL(config,SHOP_QUERY,{},signal);
    if(data.shop?.myshopifyDomain?.toLowerCase()!==config.shop||!/^gid:\/\/shopify\/Shop\/\d+$/.test(data.shop?.id??''))throw new HubError('Shopify returned a different or invalid shop identity. Check the store domain.',502);
    if(!Array.isArray(data.currentAppInstallation?.accessScopes))throw new HubError('Shopify did not return the installed app scopes.',502);
    const scopes=data.currentAppInstallation.accessScopes.map(s=>s.handle).filter(s=>typeof s==='string');
    if(!sameConnection(config))throw new HubError('Shopify connection settings changed. Check again.',409);
    return {storeId:data.shop.id,name:String(data.shop.name??'Shopify store').slice(0,200),currency:String(data.shop.currencyCode??'').slice(0,3),scopes};
  }
  async function checkShopifyConnection(){
    hub.requireOwner();const config=get('shopify:connection');if(!config||!credentials())throw new HubError('Save Shopify credentials in Settings first.',409);
    const details=await inspectShopify(config,AbortSignal.timeout(20000));set('shopify:connection',{...config,...details,verifiedAt:now()});log('owner','shopify.connection_checked',{shop:config.shop,storeId:details.storeId});return shopifyConnection();
  }
  return {shopifyConnection,saveShopifyConnection,disconnectShopify,checkShopifyConnection,inspectShopify,shopifyGraphQL};
}
