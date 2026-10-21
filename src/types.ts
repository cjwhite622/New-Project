export interface OwnerProfile {
  name:string; tone:'casual'|'professional'; experience:string; goals:string; incomeTargetCents:number;
  timeline:string; weeklyHours:number; startupBudgetCents:number; operatingBudgetCents:number; apiBudgetCents:number;
  hardCapCents:number; risk:'conservative'|'balanced'|'aggressive'; jurisdiction:string; currency:'USD'|'GBP'|'EUR'|'CAD'|'AUD';
  stage:'existing'|'chosen'|'recommend'; model:'commerce'|'services'|'content'|'digital'|'agency'|'existing';
  offer:string; assets:string; brand:string; confirmed:true;
}
export interface Agent {id:string;name:string;department:string;mission:string;jobDescription:string;tiers:number[];tools:string[];triggers:string[];escalation:string;tokenBudget:number;kpis:string[];readiness:string;enabled?:boolean;}
export interface Job {id:string;agentId:string;kind:string;prompt:string;title?:string;workflow?:{type:'launch';batchId:string;stage:'offer'|'asset'|'copy'}|{type:'shopify-page';proposalId:string}|{type:'shopify-action';approvalId:string;approvalVersion:number}|{type:'chat';conversationId:string;turnId:string};status:'queued'|'running'|'completed'|'blocked'|'failed';tier:number;createdAt:string;result:string|null;error:string|null;inputTokens:number;outputTokens:number;costCents:number;cached:boolean;provider?:string;reservedCents?:number;}
export interface ChatTurn {id:string;content:string;createdAt:string;jobId:string;approvalId:string|null;job:Job|null;}
export interface ChatConversation {id:string;agentId:string;title:string;createdAt:string;updatedAt:string;turns:ChatTurn[];}
export interface ChatSummary {id:string;agentId:string;title:string;updatedAt:string;turnCount:number;status:Job['status'];}
export interface LaunchDirection {audience:string;transformation:string;format:'toolkit'|'guide'|'audit'|'coaching';channel:'text'|'video'|'both';}
export interface LaunchBrief {version:number;direction:LaunchDirection;updatedAt:string;}
export interface LaunchBatch {id:string;briefVersion:number;direction:LaunchDirection;createdAt:string;approvalId:string|null;outdated:boolean;stages:{id:string;title:string;agentId:string;job:Job|null}[];}
export interface LaunchState {brief:LaunchBrief|null;batch:LaunchBatch|null;}
export interface Approval {id:string;agentId:string;kind:string;title:string;why:string;recommendation:string;content:string;costCents:number;risk:'low'|'medium'|'high';expectedOutcome:string;status:string;version:number;createdAt:string;execution:string;actionType?:'shopify-draft-page';receipt?:{id:string;title:string;handle:string;isPublished:boolean|null;shop:string;at:string};}
export interface ShopifyConnection {shop:string;mode:'token'|'client_credentials';clientId:string;version:number;hasCredentials:boolean;storage:string;verifiedAt:string|null;storeId?:string|null;name?:string|null;currency?:string|null;scopes?:string[];}
export interface ShopifyProposal {id:string;version:number;job:Job|null;draft:{title:string;bodyText:string}|null;handle:string;outdated:boolean;reviewOutdated:boolean;approvalId:string|null;approval:Approval|null;}
export interface ShopifyState {connection:ShopifyConnection;proposal:ShopifyProposal|null;heldActions:Approval[];}
export interface Finance {month:string;revenueCents:number;expenseCents:number;profitCents:number;taxRate:number;taxReserveCents:number;availableCents:number;verifiedRevenueCents:number;apiSpendCents:number;usage:{agentId:string;tokens:number;costCents:number;reservedCents:number}[];entries:number;daily:{date:string;incomeCents:number;expenseCents:number}[];}
export interface Provider {id:string;name:string;enabled:boolean;model:string;premiumModel:string;inputPerMillion:number;outputPerMillion:number;premiumInputPerMillion:number;premiumOutputPerMillion:number;connected:boolean;storage:string;verifiedAt:string|null;}
export interface Rules {taxRate:number;refundLimitCents:number;autoSpendLimitCents:number;autonomyThreshold:number;highRiskOptIn:boolean;highRiskCap:number;autoApproveTypes:string[];}
export interface Playbook {id:string;name:string;description:string;operations:string;fulfillment:string;agents:string[];duties:Record<string,string>;requiredConnections:string[];}
export interface AuditEntry {seq:number;at:string;actor:string;action:string;data:Record<string,unknown>;hash:string;}
export interface Check {id:string;label:string;state:string;detail:string;}
export interface HubState {profile:OwnerProfile|null;interview:{step:number;answers:Record<string,string|number|boolean>};paused:boolean;agents:Agent[];playbooks:Playbook[];providers:Provider[];rules:Rules;finance:Finance;launch:LaunchState;shopify:ShopifyState;jobs:Job[];approvals:Approval[];audit:AuditEntry[];systemCheck:Check[];phase:string;version:string;vaultPersistent:boolean;unknownUsage:{jobId:string;agentId:string;provider:string;reservedCents:number;at:string}[];}
export interface LedgerRow {id:string;date:string;kind:'income'|'expense';amountCents:number;category:string;description:string;source:string;externalId:string;verified:false;}
export interface PersonalData {goals:string;notes:string;checkIn:string;health?:string;sleep?:string;relationships?:string;growth?:string;schedule?:string;}
