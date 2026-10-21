import { id, now, hash } from './storage.mjs';
import { HubError, ledgerSchema, parse } from './validation.mjs';

export function parseCsv(input) {
  if(typeof input!=='string'||input.length>500000)throw new HubError('CSV must be text under 500 KB.');
  const rows=[];let row=[],value='',quoted=false;
  const source=input.replace(/^\uFEFF/,'');
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(char==='"'){
      if(quoted && source[i+1]==='"'){value+='"';i++;}
      else if(!quoted && value.length)throw new HubError('Malformed CSV quotes.');
      else quoted=!quoted;
    }else if(char===','&&!quoted){row.push(value);value='';}
    else if((char==='\n'||char==='\r')&&!quoted){
      if(char==='\r'&&source[i+1]==='\n')i++;
      row.push(value);if(row.some(c=>c.trim()))rows.push(row);row=[];value='';
    }else value+=char;
  }
  if(quoted)throw new HubError('CSV contains an unclosed quote.');
  row.push(value);if(row.some(c=>c.trim()))rows.push(row);
  const header=rows.shift()?.map(c=>c.trim().toLowerCase());
  const required=['date','kind','amount','category','description'];
  if(!header || required.some(c=>!header.includes(c)) || new Set(header).size!==header.length)throw new HubError('CSV needs date, kind, amount, category, description, and optional reference columns.');
  if(!rows.length||rows.length>2000)throw new HubError('Import between 1 and 2,000 rows.');
  return rows.map((cells,index)=>{
    if(cells.length!==header.length)throw new HubError(`Row ${index+2}: column count does not match.`);
    const record=Object.fromEntries(header.map((key,i)=>[key,cells[i].trim()]));
    if(!/^\d{1,8}(\.\d{1,2})?$/.test(record.amount))throw new HubError(`Row ${index+2}: invalid amount.`);
    const [whole,fraction='']=record.amount.split('.');
    const amountCents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
    return parse(ledgerSchema,{...record,amountCents,source:'csv',externalId:record.reference||hash([record.date,record.kind,amountCents,record.category,record.description])});
  });
}
export function createFinance(store) {
  const {db,get,log,transaction}=store;
  const ledger=()=>db.prepare('SELECT * FROM ledger ORDER BY date DESC, created_at DESC').all().map(r=>({id:r.id,date:r.date,kind:r.kind,amountCents:r.amount_cents,category:r.category,description:r.description,source:r.source,externalId:r.external_id,createdAt:r.created_at,verified:false}));
  const insert=record=>{
    const row=parse(ledgerSchema,record);
    const existing=db.prepare('SELECT * FROM ledger WHERE source=? AND external_id=?').get(row.source,row.externalId);
    if(existing && (existing.date!==row.date||existing.kind!==row.kind||existing.amount_cents!==row.amountCents||existing.category!==row.category||existing.description!==row.description))throw new HubError('This source reference already exists with different details. Use the original record or a new correction reference.',409);
    const result=db.prepare('INSERT OR IGNORE INTO ledger (id,date,kind,amount_cents,category,description,source,external_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id(),row.date,row.kind,row.amountCents,row.category,row.description,row.source,row.externalId,now());
    if(result.changes)log('bookkeeper','ledger.recorded',{kind:row.kind,amountCents:row.amountCents,source:row.source,externalId:row.externalId,verified:false});
    return {inserted:Boolean(result.changes)};
  };
  const finance=(month=new Date().toISOString().slice(0,7))=>{
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new HubError('Use a valid YYYY-MM month.');
    const rows=ledger().filter(r=>r.date.startsWith(month));
    const sum=kind=>rows.filter(r=>r.kind===kind).reduce((total,r)=>total+r.amountCents,0);
    const revenueCents=sum('income'),expenseCents=sum('expense'),profitCents=revenueCents-expenseCents;
    const taxRate=get('rules').taxRate;
    const taxReserveCents=Math.max(0,Math.round(profitCents*taxRate/100));
    const usage=db.prepare('SELECT agent_id as agentId, SUM(input_tokens+output_tokens) as tokens, SUM(cost_cents) as costCents, SUM(reserved_cents) as reservedCents FROM usage WHERE month=? GROUP BY agent_id').all(month);
    const apiSpendCents=usage.reduce((sum,r)=>sum+r.costCents,0);
    return {month,revenueCents,expenseCents,profitCents,taxRate,taxReserveCents,availableCents:Math.max(0,profitCents-taxReserveCents),verifiedRevenueCents:0,apiSpendCents,usage,entries:rows.length,
      daily:Array.from({length:new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate()},(_,i)=>{
        const date=`${month}-${String(i+1).padStart(2,'0')}`;const daily=rows.filter(r=>r.date===date);
        return {date,incomeCents:daily.filter(r=>r.kind==='income').reduce((n,r)=>n+r.amountCents,0),expenseCents:daily.filter(r=>r.kind==='expense').reduce((n,r)=>n+r.amountCents,0)};
      })};
  };
  return {ledger,finance,addLedger:record=>transaction(()=>insert(record)),previewCsv:parseCsv,
    importCsv:csv=>{const rows=parseCsv(csv);return transaction(()=>{let imported=0;for(const row of rows)if(insert(row).inserted)imported++;return {imported,duplicates:rows.length-imported};});},
  };
}
