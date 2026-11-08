(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CIADI_SUPPORT_OPERATIONS=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
function normalizeStatus(c){if(!c||c.verified!==true)return 'Por verificar';if(c.warning===true)return 'Atenção';return c.ok===true?'Operacional':'Indisponível';}
function aggregateAudit(rows){const actions=new Map(),days=new Map();for(const r of Array.isArray(rows)?rows:[]){const a=String(r?.acao||'Sem acção');actions.set(a,(actions.get(a)||0)+1);const parsed=r?.created_at?new Date(r.created_at):null;const d=parsed&&Number.isFinite(parsed.getTime())?parsed.toISOString().slice(0,10):'Data desconhecida';days.set(d,(days.get(d)||0)+1);}const sort=(a,b)=>b.value-a.value||a.label.localeCompare(b.label,'pt');return{total:Array.isArray(rows)?rows.length:0,byAction:[...actions].map(([label,value])=>({label,value})).sort(sort),byDay:[...days].map(([label,value])=>({label,value})).sort((a,b)=>a.label.localeCompare(b.label))};}
function summarizeStockMovements(rows){
 const a=Array.isArray(rows)?rows:[];
 const types=new Map(),days=new Map();let net=0,known=0;
 for(const row of a){
  const type=String(row?.movement_type||'Sem tipo');types.set(type,(types.get(type)||0)+1);
  const date=row?.created_at?new Date(row.created_at):null;const day=date&&Number.isFinite(date.getTime())?date.toISOString().slice(0,10):'Data desconhecida';days.set(day,(days.get(day)||0)+1);
  const quantity=Number(row?.quantity_delta);if(Number.isFinite(quantity)){net+=quantity;known++;}
 }
 const sort=(x,y)=>y.value-x.value||x.label.localeCompare(y.label,'pt');
 return{total:a.length,netQuantity:net,knownQuantities:known,byType:[...types].map(([label,value])=>({label,value})).sort(sort),byDay:[...days].map(([label,value])=>({label,value})).sort((x,y)=>x.label.localeCompare(y.label))};
}
function summarizeStockBalances(items=[],warehouses=[],movements=[]){
 const itemMap=new Map((Array.isArray(items)?items:[]).map(item=>[item.id,item]));
 const warehouseMap=new Map((Array.isArray(warehouses)?warehouses:[]).map(warehouse=>[warehouse.id,warehouse]));
 const balances=new Map();
 for(const movement of Array.isArray(movements)?movements:[]){
  const quantity=Number(movement?.quantity_delta);
  if(!movement?.item_id||!movement?.warehouse_id||!Number.isFinite(quantity))continue;
  const lot=String(movement.lot_code||'');
  const key=[movement.item_id,movement.warehouse_id,lot].join(':');
  const current=balances.get(key)||{item_id:movement.item_id,warehouse_id:movement.warehouse_id,lot_code:lot,quantity:0,movement_count:0};
  current.quantity+=quantity;current.movement_count++;balances.set(key,current);
 }
 return [...balances.values()].map(row=>{
  const item=itemMap.get(row.item_id)||{},warehouse=warehouseMap.get(row.warehouse_id)||{};
  return {...row,item_name:item.name||row.item_id,sku:item.sku||'—',warehouse_name:warehouse.name||row.warehouse_id,
   minimum_stock:Number(item.minimum_stock||0),below_minimum:Number(item.minimum_stock||0)>0&&row.quantity<=Number(item.minimum_stock||0)};
 }).sort((a,b)=>a.item_name.localeCompare(b.item_name,'pt')||a.warehouse_name.localeCompare(b.warehouse_name,'pt'));
}
function validateDocumentModel(m){const errors=[];if(!m||typeof m.code!=='string'||!/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(m.code))errors.push('Código documental inválido.');if(!Number.isInteger(m?.version)||m.version<1)errors.push('Versão inválida.');if(!Array.isArray(m?.fields)||!m.fields.length)errors.push('O modelo deve ter campos.');const keys=new Set();for(const f of m?.fields||[]){if(!f||typeof f.key!=='string'||!/^[a-z][a-z0-9_]{1,39}$/.test(f.key))errors.push('Identificador de campo inválido.');else if(keys.has(f.key))errors.push('Identificador de campo repetido.');else keys.add(f.key);}return{valid:!errors.length,errors};}
function summarizeStockAlerts(rows=[]){
 const items=(Array.isArray(rows)?rows:[])
  .filter(row=>row?.below_minimum===true&&Number(row.minimum_stock)>0)
  .map(row=>({...row,minimum_stock:Number(row.minimum_stock),quantity_on_hand:Number(row.quantity_on_hand)}))
  .sort((a,b)=>a.quantity_on_hand-b.quantity_on_hand||String(a.item_name||'').localeCompare(String(b.item_name||''),'pt'));
 return{
  total:items.length,
  outOfStock:items.filter(row=>row.quantity_on_hand<=0).length,
  belowMinimum:items.filter(row=>row.quantity_on_hand>0).length,
  items
 };
}
function summarizeProcurement(rows){const a=Array.isArray(rows)?rows:[];return{total:a.length,pending:a.filter(x=>['submitted','returned'].includes(String(x.status).toLowerCase())).length,submitted:a.filter(x=>String(x.status).toLowerCase()==='submitted').length,returned:a.filter(x=>String(x.status).toLowerCase()==='returned').length,approved:a.filter(x=>String(x.status).toLowerCase()==='approved').length,rejected:a.filter(x=>String(x.status).toLowerCase()==='rejected').length,received:a.filter(x=>String(x.status).toLowerCase()==='received').length};}

function createProcurementService({db,role,actorId,now=()=>new Date().toISOString()}={}){
  if(!db?.from)throw new Error('Cliente de dados do aprovisionamento obrigatório.');
  const allowedRoles=new Set(['suporte_informatica']);
  const validMovementTypes=new Set(['entrada','saida','ajuste_positivo','ajuste_negativo','devolucao_entrada','devolucao_saida']);
  function ensureRole(){if(!allowedRoles.has(String(role||'').toLowerCase()))throw new Error('Perfil sem autorização para gerir o aprovisionamento.');}
  function ensureActor(){if(!actorId)throw new Error('Sessão sem identificador de utilizador autenticado.');}
  function cleanText(value,max=2000){const text=String(value??'').trim();if(!text||text.length>max)throw new Error('Campo obrigatório ou com dimensão inválida.');return text;}
  function positiveNumber(value,label){const n=Number(value);if(!Number.isFinite(n)||n<=0)throw new Error(label+' deve ser superior a zero.');return n;}
  function nonNegativeOrNull(value,label){if(value===undefined||value===null||value==='')return null;const n=Number(value);if(!Number.isFinite(n)||n<0)throw new Error(label+' inválido.');return n;}
  function pick(source,keys){const out={};for(const key of keys)if(source&&source[key]!==undefined)out[key]=source[key];return out;}
  async function insertOne(table,payload){const result=await db.from(table).insert(payload).select().single();if(result?.error)throw result.error;if(!result?.data)throw new Error('A base de dados não devolveu o registo criado.');return result;}
  async function insertMany(table,payload){if(!payload.length)return[];const result=await db.from(table).insert(payload).select();if(result?.error)throw result.error;return result?.data||[];}
  function normalizeLines(lines){
    if(!Array.isArray(lines)||!lines.length)throw new Error('Adicione pelo menos uma linha ao pedido.');
    return lines.map(line=>{
      const quantity=positiveNumber(line.quantity,'Quantidade');
      const unitCost=nonNegativeOrNull(line.estimated_unit_cost,'Custo unitário');
      return {item_id:line.item_id||null,description:cleanText(line.description||line.name,500),quantity,unit_of_measure:String(line.unit_of_measure||'unidade').trim()||'unidade',estimated_unit_cost:unitCost};
    });
  }
  async function ownedRequest(requestId){
    ensureActor();
    const result=await db.from('purchase_requests').select('id,request_number,status,requested_by').eq('id',requestId).eq('requested_by',actorId).maybeSingle();
    if(result?.error)throw result.error;
    if(!result?.data)throw new Error('Pedido não encontrado ou não pertence ao utilizador autenticado.');
    return result.data;
  }
  return Object.freeze({
    async createItem(input){ensureRole();const p=pick(input,['sku','name','description','category_id','item_type','tracking_mode','unit_of_measure','brand','model','minimum_stock','active','notes']);const validTypes=['equipamento','peca','consumivel','licenca','servico'];const validTracking=['serialized','lot','quantity'];if(!String(p.sku||'').trim()||!String(p.name||'').trim()||!validTypes.includes(p.item_type)||!validTracking.includes(p.tracking_mode)||!Number.isFinite(Number(p.minimum_stock??0))||Number(p.minimum_stock??0)<0)throw new Error('Dados do artigo inválidos.');p.sku=String(p.sku).trim();p.name=String(p.name).trim();p.minimum_stock=Number(p.minimum_stock??0);p.created_by=actorId||undefined;return insertOne('items',p);},
    async createSupplier(input){ensureRole();const p=pick(input,['name','nif','contact_name','email','phone','address','notes','active']);if(!String(p.name||'').trim())throw new Error('Nome do fornecedor obrigatório.');p.name=String(p.name).trim();p.created_by=actorId||undefined;return insertOne('suppliers',p);},
    async createWarehouse(input){ensureRole();const p=pick(input,['code','name','polo','location_description','active']);if(!String(p.code||'').trim()||!String(p.name||'').trim())throw new Error('Código e nome do armazém são obrigatórios.');p.code=String(p.code).trim();p.name=String(p.name).trim();p.created_by=actorId||undefined;return insertOne('warehouses',p);},
    async createPurchaseRequest(input){
      ensureRole();ensureActor();
      const lines=normalizeLines(input?.lines);
      const estimatedTotal=lines.every(line=>line.estimated_unit_cost!==null)
        ? lines.reduce((sum,line)=>sum+line.quantity*line.estimated_unit_cost,0):null;
      const requestResult=await insertOne('purchase_requests',{
        requested_by:actorId,supplier_id:input?.supplier_id||null,status:'draft',
        justification:cleanText(input?.justification,4000),estimated_total:estimatedTotal
      });
      const request=requestResult.data;
      try{
        const savedLines=await insertMany('purchase_request_lines',lines.map(line=>({...line,request_id:request.id})));
        return Object.freeze({request,lines:savedLines});
      }catch(error){
        error.partialRequestId=request.id;
        error.partialRequestNumber=request.request_number;
        throw error;
      }
    },
    async addPurchaseRequestLines(requestId,lines){
      ensureRole();const request=await ownedRequest(requestId);
      if(!['draft','returned'].includes(request.status))throw new Error('Só é possível acrescentar linhas a pedidos em rascunho ou devolvidos.');
      const normalized=normalizeLines(lines);
      const saved=await insertMany('purchase_request_lines',normalized.map(line=>({...line,request_id:request.id})));
      return Object.freeze({request,lines:saved});
    },
    async addInventoryCountLines(countId,lines){
      ensureRole();ensureActor();
      const count=await db.from('inventory_counts').select('id,status,counted_by').eq('id',countId).eq('counted_by',actorId).maybeSingle();
      if(count?.error)throw count.error;
      if(!count?.data||count.data.status!=='draft')throw new Error('Contagem não encontrada, não pertence ao utilizador ou já foi concluída.');
      if(!Array.isArray(lines)||!lines.length)throw new Error('Adicione pelo menos um artigo à contagem.');
      const normalized=lines.map(line=>{
        const systemQuantity=Number(line.system_quantity),countedQuantity=Number(line.counted_quantity);
        if(!line.item_id||!Number.isFinite(systemQuantity)||systemQuantity<0||!Number.isFinite(countedQuantity)||countedQuantity<0)throw new Error('Artigo e quantidades não negativas são obrigatórios na contagem.');
        return {count_id:count.data.id,item_id:line.item_id,system_quantity:systemQuantity,counted_quantity:countedQuantity,notes:String(line.notes||'').trim()||null};
      });
      return insertMany('inventory_count_lines',normalized);
    },
    async submitPurchaseRequest(requestId){
      ensureRole();const request=await ownedRequest(requestId);
      if(!['draft','returned'].includes(request.status))throw new Error('O pedido não está num estado que permita submissão.');
      const lines=await db.from('purchase_request_lines').select('id').eq('request_id',request.id);
      if(lines?.error)throw lines.error;
      if(!lines?.data?.length)throw new Error('O pedido não pode ser submetido sem linhas.');
      const result=await db.from('purchase_requests').update({status:'submitted'}).eq('id',request.id).eq('requested_by',actorId).in('status',['draft','returned']).select().single();
      if(result?.error)throw result.error;
      if(!result?.data)throw new Error('O pedido não foi actualizado; confirme o estado e a autoria.');
      return result.data;
    },
    async postStockMovement(input){
      ensureRole();ensureActor();
      if(typeof db.rpc!=='function')throw new Error('RPC post_stock_movement indisponível no schema ciadi_ti.');
      if(!validMovementTypes.has(input?.movement_type))throw new Error('Tipo de movimento não permitido neste fluxo. Transferências usam a operação própria.');
      const quantity=positiveNumber(input.quantity,'Quantidade');
      const unitCost=nonNegativeOrNull(input.unit_cost,'Custo unitário');
      const result=await db.rpc('post_stock_movement',{
        p_item_id:cleanText(input.item_id,80),p_warehouse_id:cleanText(input.warehouse_id,80),
        p_movement_type:input.movement_type,p_quantity:quantity,p_reference:String(input.reference||'').trim()||null,
        p_notes:String(input.notes||'').trim()||null,p_unit_cost:unitCost,p_lot_code:String(input.lot_code||'').trim()||null
      });
      if(result?.error)throw result.error;
      if(!result?.data)throw new Error('A função não devolveu o identificador do movimento.');
      return result.data;
    },
    async transferStock(input){
      ensureRole();ensureActor();
      if(typeof db.rpc!=='function')throw new Error('RPC transfer_stock indisponível no schema ciadi_ti.');
      if(input.from_warehouse_id===input.to_warehouse_id)throw new Error('A origem e o destino têm de ser armazéns diferentes.');
      const result=await db.rpc('transfer_stock',{
        p_item_id:cleanText(input.item_id,80),p_from_warehouse_id:cleanText(input.from_warehouse_id,80),
        p_to_warehouse_id:cleanText(input.to_warehouse_id,80),p_quantity:positiveNumber(input.quantity,'Quantidade'),
        p_reference:String(input.reference||'').trim()||null,p_notes:String(input.notes||'').trim()||null,
        p_lot_code:String(input.lot_code||'').trim()||null
      });
      if(result?.error)throw result.error;
      if(!result?.data)throw new Error('A função não devolveu os movimentos de transferência.');
      return result.data;
    },
    async createInventoryCount(input){
      ensureRole();ensureActor();
      if(!Array.isArray(input?.lines)||!input.lines.length)throw new Error('Adicione pelo menos um artigo à contagem.');
      const lines=input.lines.map(line=>{
        const systemQuantity=Number(line.system_quantity),countedQuantity=Number(line.counted_quantity);
        if(!line.item_id||!Number.isFinite(systemQuantity)||systemQuantity<0||!Number.isFinite(countedQuantity)||countedQuantity<0)throw new Error('Artigo e quantidades não negativas são obrigatórios na contagem.');
        return {item_id:line.item_id,system_quantity:systemQuantity,counted_quantity:countedQuantity,notes:String(line.notes||'').trim()||null};
      });
      const countResult=await insertOne('inventory_counts',{
        warehouse_id:cleanText(input?.warehouse_id,80),status:'draft',counted_by:actorId,
        notes:String(input?.notes||'').trim()||null
      });
      const count=countResult.data;
      try{
        const savedLines=await insertMany('inventory_count_lines',lines.map(line=>({...line,count_id:count.id})));
        return Object.freeze({count,lines:savedLines});
      }catch(error){error.partialCountId=count.id;throw error;}
    },
    async markInventoryCounted(countId){
      ensureRole();ensureActor();
      const result=await db.from('inventory_counts').update({status:'counted',counted_by:actorId,counted_at:now()})
        .eq('id',countId).eq('counted_by',actorId).eq('status','draft').select().single();
      if(result?.error)throw result.error;
      if(!result?.data)throw new Error('Contagem não encontrada ou já não está em rascunho.');
      return result.data;
    }
  });
}

function collectProcurementLineRows(rows,kind){
 const fields=kind==='purchase'
  ? ['item_id','description','quantity','unit_of_measure','estimated_unit_cost']
  : kind==='count'
   ? ['item_id','system_quantity','counted_quantity','notes']
   : null;
 if(!fields)throw new Error('Tipo de linha inválido.');
 return Array.from(rows||[]).map(row=>Object.fromEntries(fields.map(key=>{
  const input=row?.querySelector?.('[name="'+key+'"]');
  return [key,input?.value??''];
 })));
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function bars(rows){if(!rows.length)return'<p class="text-sm text-slate-500">Sem registos disponíveis.</p>';const max=Math.max(1,...rows.map(x=>x.value));return'<div class="space-y-3">'+rows.map(x=>'<div><div class="flex justify-between text-xs mb-1"><span>'+esc(x.label)+'</span><b>'+x.value+'</b></div><div class="h-2 rounded-full bg-slate-100"><div class="h-2 rounded-full bg-orange" style="width:'+Math.round(x.value/max*100)+'%"></div></div></div>').join('')+'</div>';}
function create({root,supabase,navigate=()=>{},notify=()=>{},stationLabel='Suporte Informática'}={}){if(!root)throw new Error('Contentor do módulo obrigatório.');async function loadAudit(){if(!supabase?.from)return{rows:[],error:new Error('Supabase indisponível.')};const r=await supabase.from('auditoria').select('id,acao,tabela,created_at').order('created_at',{ascending:false}).limit(300);return{rows:r.data||[],error:r.error||null};}async function renderHome(){root.innerHTML='<div class="card p-6">A carregar o Centro de Operações de TI…</div>';let a;try{a=await loadAudit();}catch(e){a={rows:[],error:e};}let documentCatalog=null;try{documentCatalog=await loadDocumentCatalog();}catch(e){}const stats=aggregateAudit(a.rows);const services=[['Aplicação CIADI',{}],['Supabase',{}],['Rede institucional',{}],['Backups e recuperação',{}],['Sites e plataformas',{}]];const verifiedServices=services.filter(([,status])=>normalizeStatus(status)!=='Por verificar').length;root.innerHTML='<div class="mb-5"><span class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Tecnologia e Sistemas</span><h2 class="text-3xl font-black mt-1">Centro de Operações de TI</h2><p class="text-slate-500">Monitorização, assistência interna, aprovisionamento técnico e controlo documental.</p><span class="text-xs text-slate-500">Estação: '+esc(stationLabel)+'</span></div><div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-4"><article class="card p-5"><div class="text-sm text-slate-500">Registos de auditoria lidos</div><div class="text-3xl font-black">'+stats.total+'</div><small>Últimos 300 registos consultados</small></article><article class="card p-5"><div class="text-sm text-slate-500">Serviços verificados</div><div class="text-3xl font-black">'+verifiedServices+' / '+services.length+'</div><small>Os restantes aguardam integração</small></article><article class="card p-5"><div class="text-sm text-slate-500">Modelos documentais</div><div class="text-3xl font-black">'+(documentCatalog?documentCatalog.listDocuments().length:0)+'</div><small>'+(documentCatalog?'tipos catalogados em oito motores':'Catálogo indisponível')+'</small></article><article class="card p-5"><div class="text-sm text-slate-500">Aprovisionamento técnico</div><div class="text-2xl font-black">Por verificar</div><small>Esquema de dados por confirmar</small></article></div><div class="grid xl:grid-cols-2 gap-5 mt-5"><section class="card p-5"><div class="flex justify-between mb-4"><h3 class="font-black text-lg">Estado dos serviços</h3><button id="support-refresh" class="border rounded-xl px-3 py-2 text-sm">Actualizar</button></div>'+services.map(([n,c])=>'<div class="flex justify-between border-b py-3"><b>'+n+'</b><span class="text-xs font-bold">'+normalizeStatus(c)+'</span></div>').join('')+'<p class="text-xs text-slate-400 mt-3">Sem evidência, o estado permanece Por verificar.</p></section><section class="card p-5"><h3 class="font-black text-lg mb-4">Auditoria • Acções</h3>'+(a.error?'<p class="text-amber-700">Erro ao consultar auditoria: '+esc(a.error.message)+'</p>':bars(stats.byAction.slice(0,7)))+'</section></div><div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-5"><button data-helpdesk class="card p-5 text-left"><b>Helpdesk e incidentes</b><p class="text-sm text-slate-500 mt-2">Chamados, assistência, incidentes e histórico técnico.</p></button><button data-go="auditoria" class="card p-5 text-left"><b>Auditoria e relatórios</b><p class="text-sm text-slate-500 mt-2">Registos e análises.</p></button><button data-procurement class="card p-5 text-left"><b>Aprovisionamento informático</b><p class="text-sm text-slate-500 mt-2">Consultar inventário, equipamentos, fornecedores, armazéns e pedidos de aquisição.</p></button><button data-documents class="card p-5 text-left"><b>Motores documentais</b><p class="text-sm text-slate-500 mt-2">Modelos técnicos, validação e pré-visualização para impressão.</p></button><article class="card p-5"><b>Inventário e manutenção</b><p class="text-sm text-slate-500 mt-2">Equipamentos e intervenções técnicas.</p></article><article class="card p-5"><b>Segurança e backups</b><p class="text-sm text-slate-500 mt-2">Incidentes e evidências de recuperação.</p></article></div>';root.querySelector('#support-refresh')?.addEventListener('click',()=>renderHome().catch(e=>notify(e.message)));root.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>b.dataset.go==='auditoria'?renderAudit().catch(e=>notify(e.message)):navigate(b.dataset.go)));root.querySelector('[data-documents]')?.addEventListener('click',()=>renderDocuments().catch(e=>notify(e.message)));root.querySelector('[data-procurement]')?.addEventListener('click',()=>renderProcurement().catch(e=>notify(e.message)));root.querySelector('[data-helpdesk]')?.addEventListener('click',()=>renderHelpdesk().catch(e=>notify(e.message)));}async function renderAudit(){
  root.innerHTML='<div class="card p-5">A carregar auditoria e relatórios do Suporte Informático…</div>';
  let result;
  try{result=await loadAudit();}catch(error){result={rows:[],error};}
  const rows=result.rows||[];
  const stats=aggregateAudit(rows);
  const recent=rows.slice(0,50);
  root.innerHTML='<div class="flex flex-wrap justify-between items-center gap-3 mb-5"><div><p class="text-xs font-black uppercase tracking-widest text-orange">CIADI · Suporte Informático</p><h2 class="text-2xl font-black">Auditoria e Relatórios</h2><p class="text-sm text-slate-500">Análise dos registos de auditoria acessíveis à sessão.</p></div><div class="flex gap-2"><button id="audit-refresh" class="border rounded-xl px-3 py-2">Actualizar</button><button id="audit-back" class="border rounded-xl px-3 py-2">Voltar</button></div></div>'+
  (result.error?'<div class="card p-4 border border-amber-300 text-amber-800 mb-4">Não foi possível consultar a auditoria: '+esc(result.error.message||'erro desconhecido')+'</div>':'')+
  '<div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5"><article class="card p-4"><small>Registos consultados</small><div class="text-3xl font-black">'+stats.total+'</div></article><article class="card p-4"><small>Tipos de acção</small><div class="text-3xl font-black">'+stats.byAction.length+'</div></article><article class="card p-4"><small>Dias com actividade</small><div class="text-3xl font-black">'+stats.byDay.filter(x=>x.label!=='Data desconhecida').length+'</div></article><article class="card p-4"><small>Janela de consulta</small><div class="text-lg font-black">Últimos 300</div><small>Registos acessíveis</small></article></div>'+
  '<div class="grid xl:grid-cols-2 gap-5 mb-5"><section class="card p-5"><h3 class="font-black mb-3">Acções mais frequentes</h3>'+bars(stats.byAction.slice(0,12))+'</section><section class="card p-5"><h3 class="font-black mb-3">Actividade por dia</h3>'+bars(stats.byDay.slice(-14))+'</section></div>'+
  '<section class="card p-5"><h3 class="font-black mb-3">Registos recentes</h3>'+(recent.length?'<div class="overflow-x-auto"><table class="w-full min-w-[560px] text-sm"><thead><tr class="text-left border-b"><th class="py-2">Data</th><th>Acção</th><th>Tabela / área</th><th>ID</th></tr></thead><tbody>'+recent.map(row=>'<tr class="border-b"><td class="py-2">'+esc(row.created_at||'')+'</td><td>'+esc(row.acao||'Sem acção')+'</td><td>'+esc(row.tabela||'—')+'</td><td>'+esc(row.id||'—')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="text-sm text-slate-500">Sem registos disponíveis.</p>')+'</section>'+
  '<p class="text-xs text-slate-500 mt-4">Os indicadores representam apenas os até 300 registos devolvidos pela consulta e permitidos pelas políticas de acesso. Não representam uma contagem global nem substituem um relatório contabilístico ou clínico.</p>';
  root.querySelector('#audit-back').addEventListener('click',()=>renderHome().catch(e=>notify(e.message)));
  root.querySelector('#audit-refresh').addEventListener('click',()=>renderAudit().catch(e=>notify(e.message)));
}async function renderHelpdesk(){const module=globalThis.CIADI_SUPPORT_HELPDESK;if(!module){root.innerHTML='<div class="card p-5">Módulo Helpdesk indisponível nesta versão.</div>';return;}await module.create({root,supabase,notify,onBack:renderHome}).render();}async function renderProcurement(){
  root.innerHTML='<div class="card p-5">A consultar o Aprovisionamento Informático…</div>';
  if(!supabase?.schema){root.innerHTML='<div class="card p-5"><h2 class="text-xl font-black">Aprovisionamento Informático</h2><p class="text-amber-700 mt-2">O cliente Supabase não disponibiliza acesso ao schema ciadi_ti. Não foram feitas alterações.</p><button id="proc-back" class="border rounded-xl px-3 py-2 mt-4">Voltar</button></div>';root.querySelector('#proc-back').onclick=()=>renderHome();return;}
  const db=supabase.schema('ciadi_ti');
  let actorRole=null,actorId=null;
  try{
    const auth=await supabase.auth?.getUser?.();
    const user=auth?.data?.user;
    if(user?.id){actorId=user.id;const profile=await supabase.from('perfis').select('tipo').eq('id',user.id).maybeSingle();if(!profile.error)actorRole=profile.data?.tipo||null;}
  }catch(_error){actorRole=null;actorId=null;}
  const canManage=String(actorRole||'').toLowerCase()==='suporte_informatica';
  const procurementService=canManage?createProcurementService({db,role:actorRole,actorId}):null;
  const lifecycleModule=typeof window!=='undefined'?window.CIADI_SUPPORT_INVENTORY_LIFECYCLE:null;
  const lifecycleService=canManage&&lifecycleModule?lifecycleModule.createInventoryLifecycleService({db,role:actorRole,actorId}):null;
  const specs=[
    ['items','id,sku,name,item_type,tracking_mode,minimum_stock,active','name'],
    ['assets','id,item_id,serial_number,asset_tag,status,acquired_at,warranty_until','created_at'],
    ['suppliers','id,name,nif,email,phone,active','name'],
    ['warehouses','id,code,name,polo,active','name'],
    ['purchase_requests','id,request_number,requested_by,supplier_id,status,justification,estimated_total,finance_decision_by,finance_decision_at,finance_decision_note,created_at','created_at'],
    ['purchase_request_lines','id,request_id,item_id,description,quantity,unit_of_measure,estimated_unit_cost,created_at','created_at'],
    ['stock_movements','id,item_id,warehouse_id,movement_type,quantity_delta,unit_cost,lot_code,reference,notes,created_at','created_at'],
    ['inventory_counts','id,warehouse_id,status,counted_by,reconciled_by,counted_at,reconciled_at,notes,created_at','created_at'],
    ['inventory_count_lines','id,count_id,item_id,system_quantity,counted_quantity,variance,notes,created_at','created_at'],
    ['goods_receipts','id,receipt_number,purchase_request_id,supplier_id,warehouse_id,delivery_reference,delivery_date,status,notes,created_by,checked_by,checked_at,posted_by,posted_at,created_at','created_at'],
    ['goods_receipt_lines','id,receipt_id,purchase_request_line_id,item_id,ordered_quantity,received_quantity,accepted_quantity,damaged_quantity,unit_cost,lot_code,notes,movement_id,created_at','created_at'],
    ['audit_events','id,table_name,record_id,action,actor_id,occurred_at','occurred_at']
  ];
  const results=await Promise.all(specs.map(async([table,columns,order])=>{try{const q=await db.from(table).select(columns).order(order,{ascending:false}).limit(100);return{table,rows:q.data||[],error:q.error};}catch(error){return{table,rows:[],error};}}));
  const by=Object.fromEntries(results.map(x=>[x.table,x]));
  let balances={rows:[],error:null};
  try{const q=await db.from('stock_balances').select('*').limit(100);balances={rows:q.data||[],error:q.error||null};}catch(error){balances={rows:[],error};}
  const errors=[...results.filter(x=>x.error),...(balances.error?[{table:'stock_balances',error:balances.error}]:[])];
  const items=by.items.rows,assets=by.assets.rows,requests=by.purchase_requests.rows,movements=by.stock_movements.rows;
  const metrics=summarizeProcurement(requests),movementStats=summarizeStockMovements(movements),stockAlerts=summarizeStockAlerts(balances.rows);
  const count=(name)=>by[name].rows.length;
  const receiptLineRows=by.goods_receipt_lines.rows;
  const receiptRows=by.goods_receipts.rows.map(receipt=>{const lines=receiptLineRows.filter(line=>line.receipt_id===receipt.id);return {...receipt,received_quantity:lines.reduce((sum,line)=>sum+Number(line.received_quantity||0),0),accepted_quantity:lines.reduce((sum,line)=>sum+Number(line.accepted_quantity||0),0),damaged_quantity:lines.reduce((sum,line)=>sum+Number(line.damaged_quantity||0),0),line_count:lines.length};});
  const receiptStats=lifecycleModule?lifecycleModule.summarizeGoodsReceipts(receiptRows):{total:0,draft:0,checked:0,posted:0,receivedQuantity:0,acceptedQuantity:0,damagedQuantity:0,discrepancies:0};
  const receiptDiscrepancies=lifecycleModule?lifecycleModule.summarizeReceiptDiscrepancies(receiptLineRows):{lines:0,shortages:0,excesses:0,damagedLines:0,shortageQuantity:0,excessQuantity:0,damagedQuantity:0};
  const countStatusById=new Map(by.inventory_counts.rows.map(row=>[row.id,row.status]));
  const inventoryStats=lifecycleModule?lifecycleModule.summarizeInventoryReconciliation(by.inventory_count_lines.rows.map(line=>({...line,status:countStatusById.get(line.count_id)||'draft'}))):{total:0,draft:0,counted:0,reconciled:0,varianceLines:0,shortageQuantity:0,surplusQuantity:0};
  const receiptSchemaReady=!by.goods_receipts.error&&!by.goods_receipt_lines.error;
  const table=(title,rows,cols)=>'<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">'+title+'</h3>'+(rows.length?'<div class="overflow-auto"><table class="w-full text-sm"><thead><tr class="border-b text-left">'+cols.map(x=>'<th class="p-2">'+x[1]+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr class="border-b">'+cols.map(x=>'<td class="p-2">'+esc(row[x[0]]??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<p class="text-sm text-slate-500">Sem registos disponíveis.</p>')+'</section>';
  const countTable='<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">Contagens de inventário</h3>'+(by.inventory_counts.rows.length?'<div class="overflow-auto"><table class="w-full text-sm"><thead><tr class="border-b text-left"><th class="p-2">Data</th><th>Armazém</th><th>Estado</th><th>Contado em</th><th>Acção</th></tr></thead><tbody>'+by.inventory_counts.rows.map(row=>'<tr class="border-b"><td class="p-2">'+esc(row.created_at)+'</td><td>'+esc(row.warehouse_id)+'</td><td>'+esc(row.status)+'</td><td>'+esc(row.counted_at||'—')+'</td><td>'+(canManage&&row.status==='draft'?'<button data-counted="'+esc(row.id)+'" class="border rounded-lg px-2 py-1">Marcar contagem concluída</button>':canManage&&row.status==='counted'?'<button data-reconcile-count="'+esc(row.id)+'" class="border rounded-lg px-2 py-1">Reconciliar e lançar ajustes</button>':'—')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="text-sm text-slate-500">Sem contagens de inventário.</p>')+'</section>';
  const receiptTable='<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">Recepção e conferência de mercadorias</h3><div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4"><div class="border rounded-xl p-3"><small>Recepções</small><div class="text-2xl font-black">'+receiptStats.total+'</div></div><div class="border rounded-xl p-3"><small>Conferidas</small><div class="text-2xl font-black">'+receiptStats.checked+'</div></div><div class="border rounded-xl p-3"><small>Publicadas em stock</small><div class="text-2xl font-black">'+receiptStats.posted+'</div></div><div class="border rounded-xl p-3"><small>Linhas com divergência</small><div class="text-2xl font-black">'+(receiptDiscrepancies.shortages+receiptDiscrepancies.excesses+receiptDiscrepancies.damagedLines)+'</div></div></div>'+(by.goods_receipts.error||by.goods_receipt_lines.error?'<p class="text-amber-700 text-sm">A estrutura de recepção ainda não está disponível na Data API. A proposta SQL está em revisão e não foi aplicada.</p>':receiptRows.length?'<div class="overflow-auto"><table class="w-full text-sm"><thead><tr class="border-b text-left"><th class="p-2">N.º</th><th>Encomenda</th><th>Guia fornecedor</th><th>Data</th><th>Estado</th><th>Recebido</th><th>Aceite</th><th>Acção</th></tr></thead><tbody>'+receiptRows.map(row=>'<tr class="border-b"><td class="p-2">'+esc(row.receipt_number||row.id)+'</td><td>'+esc(row.purchase_request_id)+'</td><td>'+esc(row.delivery_reference||'—')+'</td><td>'+esc(row.delivery_date||'—')+'</td><td>'+esc(row.status)+'</td><td>'+esc(row.received_quantity)+'</td><td>'+esc(row.accepted_quantity)+'</td><td>'+(canManage&&row.status==='draft'?'<button data-receipt-check="'+esc(row.id)+'" class="border rounded-lg px-2 py-1">Conferir</button>':canManage&&row.status==='checked'?'<button data-receipt-finalize="'+esc(row.id)+'" class="border rounded-lg px-2 py-1">Dar entrada em stock</button>':'—')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="text-sm text-slate-500">Ainda não existem recepções registadas.</p>')+'<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-sm"><div>Faltas: <b>'+receiptDiscrepancies.shortages+'</b> ('+receiptDiscrepancies.shortageQuantity+')</div><div>Excessos: <b>'+receiptDiscrepancies.excesses+'</b> ('+receiptDiscrepancies.excessQuantity+')</div><div>Linhas danificadas: <b>'+receiptDiscrepancies.damagedLines+'</b></div><div>Quantidade danificada: <b>'+receiptDiscrepancies.damagedQuantity+'</b></div></div></section>';
  const requestTable='<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">Pedidos de aquisição</h3>'+(requests.length?'<div class="overflow-auto"><table class="w-full text-sm"><thead><tr class="border-b text-left"><th class="p-2">N.º pedido</th><th>Estado</th><th>Justificação</th><th>Estimativa (Kz)</th><th>Acção</th></tr></thead><tbody>'+requests.map(row=>'<tr class="border-b"><td class="p-2">'+esc(row.request_number)+'</td><td>'+esc(row.status)+'</td><td>'+esc(row.justification)+'</td><td>'+esc(row.estimated_total??'—')+'</td><td>'+(canManage&&row.requested_by===actorId&&['draft','returned'].includes(row.status)?'<button data-submit-request="'+esc(row.id)+'" class="border rounded-lg px-2 py-1">Submeter</button>':'—')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="text-sm text-slate-500">Sem pedidos de aquisição.</p>')+'</section>';
  const dynamicTable=(title,rows)=>{const cols=rows.length?Object.keys(rows[0]):[];return '<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">'+title+'</h3>'+(rows.length?'<div class="overflow-auto"><table class="w-full text-sm"><thead><tr class="border-b text-left">'+cols.map(x=>'<th class="p-2">'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr class="border-b">'+cols.map(x=>'<td class="p-2">'+esc(row[x]??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<p class="text-sm text-slate-500">Sem saldos disponíveis na vista stock_balances.</p>')+'</section>';};
  const forms=canManage
    ? '<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">Registar no catálogo</h3><div class="grid xl:grid-cols-3 gap-4">'+
      '<form data-proc-form="item" class="border rounded-xl p-4 space-y-2"><b>Novo artigo</b><input name="sku" required placeholder="Referência / SKU" class="w-full border rounded-lg p-2"><input name="name" required placeholder="Designação" class="w-full border rounded-lg p-2"><select name="item_type" required class="w-full border rounded-lg p-2"><option value="equipamento">Equipamento</option><option value="peca">Peça</option><option value="consumivel">Consumível</option><option value="licenca">Licença</option><option value="servico">Serviço</option></select><select name="tracking_mode" required class="w-full border rounded-lg p-2"><option value="quantity">Por quantidade</option><option value="serialized">Por número de série</option><option value="lot">Por lote</option></select><input name="minimum_stock" type="number" min="0" step="0.01" value="0" required placeholder="Stock mínimo" class="w-full border rounded-lg p-2"><button class="bg-orange text-white rounded-lg px-3 py-2 font-bold" type="submit">Guardar artigo</button></form>'+
      '<form data-proc-form="supplier" class="border rounded-xl p-4 space-y-2"><b>Novo fornecedor</b><input name="name" required placeholder="Nome / firma" class="w-full border rounded-lg p-2"><input name="nif" placeholder="NIF" class="w-full border rounded-lg p-2"><input name="email" type="email" placeholder="Email" class="w-full border rounded-lg p-2"><input name="phone" placeholder="Telefone" class="w-full border rounded-lg p-2"><button class="bg-orange text-white rounded-lg px-3 py-2 font-bold" type="submit">Guardar fornecedor</button></form>'+
      '<form data-proc-form="warehouse" class="border rounded-xl p-4 space-y-2"><b>Novo armazém</b><input name="code" required placeholder="Código" class="w-full border rounded-lg p-2"><input name="name" required placeholder="Designação" class="w-full border rounded-lg p-2"><input name="polo" placeholder="Polo / centro" class="w-full border rounded-lg p-2"><input name="location_description" placeholder="Localização" class="w-full border rounded-lg p-2"><button class="bg-orange text-white rounded-lg px-3 py-2 font-bold" type="submit">Guardar armazém</button></form></div><p class="text-xs text-slate-500 mt-3">A gravação depende das políticas RLS e das permissões efectivas do utilizador. Nenhuma aprovação financeira é disponibilizada nesta estação.</p></section>'
    : '<section class="card p-4 mt-5"><b>Modo de consulta</b><p class="text-sm text-slate-500 mt-1">O perfil autenticado não foi identificado como Suporte Informática, Administração ou Gestão. Não são apresentados controlos de gravação.</p></section>';
  const itemOptions=items.filter(item=>item.active).map(item=>'<option value="'+esc(item.id)+'">'+esc(item.sku)+' — '+esc(item.name)+'</option>').join('');
  const warehouseOptions=by.warehouses.rows.filter(item=>item.active).map(item=>'<option value="'+esc(item.id)+'">'+esc(item.code)+' — '+esc(item.name)+'</option>').join('');
  const supplierOptions=by.suppliers.rows.filter(item=>item.active).map(item=>'<option value="'+esc(item.id)+'">'+esc(item.name)+'</option>').join('');
  const purchaseLineRow='<div data-line-row class="rounded-lg border p-3 space-y-2"><div data-line-collection="purchase" class="space-y-2">'+purchaseLineRow+'</div><button type="button" data-add-line="purchase" class="border rounded-lg px-3 py-2 text-sm">Adicionar outra linha</button><button type="button" data-remove-line class="text-sm text-red-700">Remover linha</button></div>';
  const countLineRow='<div data-line-row class="rounded-lg border p-3 space-y-2"><select name="item_id" required class="w-full border rounded-lg p-2"><option value="">Seleccionar artigo</option>'+itemOptions+'</select><div class="grid sm:grid-cols-2 gap-2"><input name="system_quantity" type="number" min="0" step="0.001" required placeholder="Quantidade no sistema" class="border rounded-lg p-2"><input name="counted_quantity" type="number" min="0" step="0.001" required placeholder="Quantidade contada" class="border rounded-lg p-2"></div><input name="notes" placeholder="Observações da linha" class="w-full border rounded-lg p-2"><button type="button" data-remove-line class="text-sm text-red-700">Remover artigo</button></div>';
  const approvedRequests=requests.filter(row=>row.status==='approved');
  const approvedRequestOptions=approvedRequests.map(row=>'<option value="'+esc(row.id)+'">Pedido #'+esc(row.request_number)+'</option>').join('');
  const receiptLineOptions=by.purchase_request_lines.rows.filter(line=>line.item_id&&approvedRequests.some(request=>request.id===line.request_id)).map(line=>{const request=approvedRequests.find(row=>row.id===line.request_id);return '<option value="'+esc(line.id)+'">#'+esc(request?.request_number||'')+' — '+esc(line.description)+' · encomendado: '+esc(line.quantity)+'</option>';}).join('');
  const receiptLineRow='<div data-line-row class="border rounded-lg p-3 space-y-2"><select name="purchase_request_line_id" required class="w-full border rounded-lg p-2"><option value="">Seleccionar linha da encomenda</option>'+receiptLineOptions+'</select><div class="grid sm:grid-cols-3 gap-2"><input name="received_quantity" type="number" min="0" step="0.001" required placeholder="Recebida" class="border rounded-lg p-2"><input name="accepted_quantity" type="number" min="0" step="0.001" required placeholder="Aceite" class="border rounded-lg p-2"><input name="damaged_quantity" type="number" min="0" step="0.001" value="0" required placeholder="Danificada" class="border rounded-lg p-2"><input name="returned_quantity" type="number" min="0" step="0.001" value="0" required placeholder="Devolvida ao fornecedor" class="border rounded-lg p-2"></div><input name="unit_cost" type="number" min="0" step="0.01" placeholder="Custo unitário (Kz)" class="w-full border rounded-lg p-2"><input name="lot_code" placeholder="Lote (opcional)" class="w-full border rounded-lg p-2"><input name="line_notes" placeholder="Observações da linha" class="w-full border rounded-lg p-2"><button type="button" data-remove-line class="text-sm text-red-700">Remover linha</button></div>';
  const receiptWorkflow=canManage&&lifecycleService&&receiptSchemaReady
    ? '<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">Nova recepção de mercadorias</h3><form data-lifecycle-form="receipt" class="space-y-3"><div class="grid md:grid-cols-2 gap-3"><select name="purchase_request_id" required class="border rounded-lg p-2"><option value="">Seleccionar pedido aprovado</option>'+approvedRequestOptions+'</select><select name="warehouse_id" required class="border rounded-lg p-2"><option value="">Seleccionar armazém de destino</option>'+warehouseOptions+'</select><input name="delivery_reference" placeholder="N.º guia / documento do fornecedor" class="border rounded-lg p-2"><input name="delivery_date" type="date" class="border rounded-lg p-2"><textarea name="notes" placeholder="Observações gerais da recepção" class="border rounded-lg p-2 md:col-span-2"></textarea></div><div data-line-collection="receipt" class="space-y-2">'+receiptLineRow+'</div><div class="flex flex-wrap gap-2"><button type="button" data-add-line="receipt" class="border rounded-lg px-3 py-2">Adicionar linha</button><button type="submit" class="bg-orange text-white rounded-lg px-4 py-2 font-bold">Guardar recepção em rascunho</button></div><p class="text-xs text-slate-500">A gravação não altera o stock. A entrada só ocorre após conferência e finalização transaccional.</p></form></section>'
    : '<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-2">Recepção de mercadorias</h3><p class="text-sm text-amber-700">'+(by.goods_receipts.error||by.goods_receipt_lines.error?'A estrutura SQL ainda não está aplicada ou exposta na Data API. A proposta encontra-se em revisão.':'O motor de recepção não está disponível para esta sessão.')+'</p></section>';
  const workflowForms=canManage
    ? '<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">Operações de Aprovisionamento</h3><div class="grid xl:grid-cols-2 gap-4">'+
      '<form data-proc-form="purchase" class="border rounded-xl p-4 space-y-2"><b>Novo pedido de aquisição</b><select name="supplier_id" class="w-full border rounded-lg p-2"><option value="">Fornecedor por definir</option>'+supplierOptions+'</select><textarea name="justification" required maxlength="4000" placeholder="Justificação da necessidade" class="w-full border rounded-lg p-2"></textarea><div data-line-collection="purchase" class="space-y-2">'+purchaseLineRow+'</div><button type="button" data-add-line="purchase" class="border rounded-lg px-3 py-2 text-sm">Adicionar outra linha</button><button class="bg-orange text-white rounded-lg px-3 py-2 font-bold" type="submit">Guardar pedido em rascunho</button><p class="text-xs text-slate-500">A submissão não aprova a compra. A decisão continua reservada à Administração.</p></form>'+
      '<form data-proc-form="purchase-lines" class="border rounded-xl p-4 space-y-2"><b>Completar pedido em rascunho</b><input name="request_id" required placeholder="ID do pedido em rascunho" class="w-full border rounded-lg p-2"><div data-line-collection="purchase" class="space-y-2">'+purchaseLineRow+'</div><button type="button" data-add-line="purchase" class="border rounded-lg px-3 py-2 text-sm">Adicionar outra linha</button><button class="border rounded-lg px-3 py-2 font-bold" type="submit">Adicionar linha ao rascunho</button><p class="text-xs text-slate-500">Usar se a gravação das linhas falhar depois de criado o cabeçalho do pedido.</p></form>'+
      '<form data-proc-form="movement" class="border rounded-xl p-4 space-y-2"><b>Registar movimento de stock</b><select name="item_id" required class="w-full border rounded-lg p-2"><option value="">Seleccionar artigo</option>'+itemOptions+'</select><select name="warehouse_id" required class="w-full border rounded-lg p-2"><option value="">Seleccionar armazém</option>'+warehouseOptions+'</select><select name="movement_type" required class="w-full border rounded-lg p-2"><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="ajuste_positivo">Ajuste positivo</option><option value="ajuste_negativo">Ajuste negativo</option><option value="devolucao_entrada">Devolução de entrada</option><option value="devolucao_saida">Devolução de saída</option></select><div class="grid sm:grid-cols-2 gap-2"><input name="quantity" type="number" min="0.001" step="0.001" required placeholder="Quantidade" class="border rounded-lg p-2"><input name="unit_cost" type="number" min="0" step="0.01" placeholder="Custo unitário (Kz)" class="border rounded-lg p-2"></div><input name="lot_code" placeholder="Lote (se aplicável)" class="w-full border rounded-lg p-2"><input name="reference" placeholder="Referência documental" class="w-full border rounded-lg p-2"><textarea name="notes" placeholder="Observações" class="w-full border rounded-lg p-2"></textarea><button class="bg-orange text-white rounded-lg px-3 py-2 font-bold" type="submit">Registar movimento</button><p class="text-xs text-slate-500">O saldo e a disponibilidade são validados pela função transaccional do banco.</p></form>'+
      '<form data-proc-form="transfer" class="border rounded-xl p-4 space-y-2"><b>Transferir stock entre armazéns</b><select name="item_id" required class="w-full border rounded-lg p-2"><option value="">Seleccionar artigo</option>'+itemOptions+'</select><div class="grid sm:grid-cols-2 gap-2"><select name="from_warehouse_id" required class="border rounded-lg p-2"><option value="">Armazém de origem</option>'+warehouseOptions+'</select><select name="to_warehouse_id" required class="border rounded-lg p-2"><option value="">Armazém de destino</option>'+warehouseOptions+'</select></div><input name="quantity" type="number" min="0.001" step="0.001" required placeholder="Quantidade" class="w-full border rounded-lg p-2"><input name="lot_code" placeholder="Lote (se aplicável)" class="w-full border rounded-lg p-2"><input name="reference" placeholder="Referência documental" class="w-full border rounded-lg p-2"><textarea name="notes" placeholder="Observações" class="w-full border rounded-lg p-2"></textarea><button class="bg-orange text-white rounded-lg px-3 py-2 font-bold" type="submit">Executar transferência</button><p class="text-xs text-slate-500">A saída e a entrada são registadas numa única operação transaccional.</p></form>'+
      '<form data-proc-form="count-lines" class="border rounded-xl p-4 space-y-2"><b>Completar contagem em rascunho</b><input name="count_id" required placeholder="ID da contagem em rascunho" class="w-full border rounded-lg p-2"><div data-line-collection="count" class="space-y-2">'+countLineRow+'</div><button type="button" data-add-line="count" class="border rounded-lg px-3 py-2 text-sm">Adicionar artigo</button><textarea name="count_notes" placeholder="Observações gerais" class="w-full border rounded-lg p-2"></textarea><button class="border rounded-lg px-3 py-2 font-bold" type="submit">Adicionar artigo à contagem</button><p class="text-xs text-slate-500">Usar se a gravação das linhas falhar depois de criado o cabeçalho.</p></form>'+
      '<form data-proc-form="count" class="border rounded-xl p-4 space-y-2"><b>Nova contagem de inventário</b><select name="warehouse_id" required class="w-full border rounded-lg p-2"><option value="">Seleccionar armazém</option>'+warehouseOptions+'</select><div data-line-collection="count" class="space-y-2">'+countLineRow+'</div><button type="button" data-add-line="count" class="border rounded-lg px-3 py-2 text-sm">Adicionar artigo</button><textarea name="count_notes" placeholder="Observações gerais da contagem" class="w-full border rounded-lg p-2"></textarea><button class="bg-orange text-white rounded-lg px-3 py-2 font-bold" type="submit">Guardar contagem em rascunho</button><p class="text-xs text-slate-500">A reconciliação final continua separada da contagem física.</p></form></div></section>'
    : '';
  root.innerHTML='<div class="mb-4 flex items-center justify-between gap-3"><div><p class="text-xs font-black uppercase tracking-widest text-orange">Suporte Informática</p><h2 class="text-2xl font-black">Aprovisionamento Informático</h2><p class="text-sm text-slate-500">Gestão do catálogo, pedidos de aquisição, movimentos de stock, transferências e contagens de inventário.</p></div><button id="proc-back" class="border rounded-xl px-3 py-2">Voltar</button></div>'+
  '<div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-4"><article class="card p-4"><small>Artigos activos</small><div class="text-3xl font-black">'+items.filter(x=>x.active).length+'</div></article><article class="card p-4"><small>Equipamentos</small><div class="text-3xl font-black">'+assets.length+'</div></article><article class="card p-4"><small>Fornecedores activos</small><div class="text-3xl font-black">'+by.suppliers.rows.filter(x=>x.active).length+'</div></article><article class="card p-4"><small>Pedidos pendentes</small><div class="text-3xl font-black">'+metrics.pending+'</div></article><article class="card p-4"><small>Artigos abaixo do mínimo</small><div class="text-3xl font-black">'+stockAlerts.total+'</div><small>'+stockAlerts.outOfStock+' sem saldo</small></article></div>'+
  forms+workflowForms+receiptWorkflow+'<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">Movimentos de stock • análise</h3><div class="grid sm:grid-cols-3 gap-3 mb-4"><article class="rounded-xl border p-3"><small>Movimentos carregados</small><div class="text-2xl font-black">'+movementStats.total+'</div></article><article class="rounded-xl border p-3"><small>Soma líquida das quantidades</small><div class="text-2xl font-black">'+movementStats.netQuantity+'</div></article><article class="rounded-xl border p-3"><small>Registos com quantidade válida</small><div class="text-2xl font-black">'+movementStats.knownQuantities+'</div></article></div><div class="grid xl:grid-cols-2 gap-5"><div><h4 class="font-bold mb-3">Movimentos por tipo</h4>'+bars(movementStats.byType)+'</div><div><h4 class="font-bold mb-3">Movimentos por dia</h4>'+bars(movementStats.byDay)+'</div></div><p class="text-xs text-slate-500 mt-3">Análise dos movimentos carregados (até 100 registos); saldos estimados por artigo/armazém/lote não substituem um fecho de inventário.</p></section><section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">Pedidos de aquisição</h3><div class="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm"><div>Submetidos: <b>'+metrics.submitted+'</b></div><div>Devolvidos: <b>'+metrics.returned+'</b></div><div>Aprovados: <b>'+metrics.approved+'</b></div><div>Rejeitados: <b>'+metrics.rejected+'</b></div><div>Recebidos: <b>'+metrics.received+'</b></div></div><p class="text-xs text-slate-500 mt-3">O Suporte pode acompanhar e preparar pedidos; a decisão financeira continua reservada à Administração.</p></section>'+
  table('Catálogo de artigos',items,[['sku','Referência'],['name','Artigo'],['item_type','Tipo'],['tracking_mode','Rastreio'],['minimum_stock','Stock mínimo'],['active','Activo']])+
  table('Equipamentos individualizados',assets,[['asset_tag','Património'],['serial_number','N.º série'],['item_id','Artigo (ID)'],['status','Estado'],['warranty_until','Garantia até']])+
  table('Fornecedores',by.suppliers.rows,[['name','Fornecedor'],['nif','NIF'],['email','Email'],['phone','Telefone'],['active','Activo']])+
  table('Armazéns',by.warehouses.rows,[['code','Código'],['name','Armazém'],['polo','Polo'],['active','Activo']])+
  dynamicTable('Saldos de stock por artigo e armazém',balances.rows)+
  '<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-2">Alertas de stock mínimo</h3><p class="text-sm text-slate-500 mb-3">'+stockAlerts.total+' combinações artigo/armazém abaixo do mínimo configurado; '+stockAlerts.outOfStock+' sem saldo disponível.</p>'+(stockAlerts.items.length?'<div class="overflow-auto"><table class="w-full text-sm"><thead><tr class="border-b text-left"><th class="p-2">Referência</th><th>Artigo</th><th>Armazém</th><th>Saldo</th><th>Mínimo</th></tr></thead><tbody>'+stockAlerts.items.map(row=>'<tr class="border-b"><td class="p-2">'+esc(row.sku||'—')+'</td><td>'+esc(row.item_name||'—')+'</td><td>'+esc(row.warehouse_code||row.warehouse_name||'—')+'</td><td>'+esc(row.quantity_on_hand)+'</td><td>'+esc(row.minimum_stock)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="text-sm text-slate-500">Sem alertas para os artigos com stock mínimo configurado.</p>')+'</section>'+
  table('Movimentos de stock',movements,[['created_at','Data'],['movement_type','Movimento'],['item_id','Artigo (ID)'],['warehouse_id','Armazém (ID)'],['quantity_delta','Variação'],['reference','Referência']])+
  receiptTable+
  countTable+
  table('Eventos de auditoria do inventário',by.audit_events.rows,[['occurred_at','Data'],['table_name','Tabela'],['action','Acção'],['record_id','Registo']])+
  requestTable+table('Linhas dos pedidos',by.purchase_request_lines.rows,[['request_id','Pedido (ID)'],['description','Descrição'],['quantity','Quantidade'],['unit_of_measure','Unidade'],['estimated_unit_cost','Custo unitário (Kz)']])+table('Linhas das contagens de inventário',by.inventory_count_lines.rows,[['count_id','Contagem (ID)'],['item_id','Artigo (ID)'],['system_quantity','Quantidade sistema'],['counted_quantity','Quantidade contada'],['variance','Diferença']])+
  (errors.length?'<div class="card p-4 mt-5 border border-amber-300"><b>Consultas com erro</b><ul class="list-disc pl-5 text-sm">'+errors.map(x=>'<li>'+esc(x.table)+': '+esc(x.error?.message||'Erro de consulta')+'</li>').join('')+'</ul></div>':'')+
  '<p class="text-xs text-slate-400 mt-4">Consultas limitadas aos 100 registos mais recentes/ordenados por tabela. Os totais apresentados correspondem à amostra carregada, não a contagens globais. Nenhum registo foi criado ou alterado.</p>';
  root.querySelector('#proc-back').addEventListener('click',()=>renderHome().catch(e=>notify(e.message)));
  root.querySelectorAll('[data-counted]').forEach(button=>button.addEventListener('click',async()=>{
    if(!procurementService)return;
    button.disabled=true;
    try{await procurementService.markInventoryCounted(button.dataset.counted);notify('Contagem física marcada como concluída. A reconciliação permanece pendente.');await renderProcurement();}
    catch(error){button.disabled=false;notify('Não foi possível concluir a contagem: '+(error?.message||'erro desconhecido'));}
  }));
  root.querySelectorAll('[data-receipt-check]').forEach(button=>button.addEventListener('click',async()=>{if(!lifecycleService)return;button.disabled=true;try{await lifecycleService.checkGoodsReceipt(button.dataset.receiptCheck);notify('Recepção conferida. O stock ainda não foi alterado.');await renderProcurement();}catch(error){button.disabled=false;notify('Não foi possível conferir a recepção: '+(error?.message||'erro desconhecido'));}}));
  root.querySelectorAll('[data-receipt-finalize]').forEach(button=>button.addEventListener('click',async()=>{if(!lifecycleService)return;button.disabled=true;try{const result=await lifecycleService.finalizeGoodsReceipt(button.dataset.receiptFinalize);notify('Recepção publicada. Movimentos criados: '+(result.movements_created??'—')+'.');await renderProcurement();}catch(error){button.disabled=false;notify('Não foi possível dar entrada em stock: '+(error?.message||'erro desconhecido'));}}));
  root.querySelectorAll('[data-reconcile-count]').forEach(button=>button.addEventListener('click',async()=>{if(!lifecycleService)return;button.disabled=true;try{const result=await lifecycleService.reconcileInventoryCount(button.dataset.reconcileCount);notify('Inventário reconciliado. Ajustes lançados: '+(result.movements_created??'—')+'.');await renderProcurement();}catch(error){button.disabled=false;notify('Não foi possível reconciliar o inventário: '+(error?.message||'erro desconhecido'));}}));
  root.querySelector('[data-lifecycle-form="receipt"]')?.addEventListener('submit',async event=>{event.preventDefault();if(!lifecycleService){notify('Motor de recepção indisponível para esta sessão.');return;}const form=event.currentTarget;const lines=[...form.querySelectorAll('[data-line-row]')].map(row=>({purchaseRequestLineId:row.querySelector('[name="purchase_request_line_id"]')?.value,received_quantity:row.querySelector('[name="received_quantity"]')?.value,accepted_quantity:row.querySelector('[name="accepted_quantity"]')?.value,damaged_quantity:row.querySelector('[name="damaged_quantity"]')?.value,returned_quantity:row.querySelector('[name="returned_quantity"]')?.value,unit_cost:row.querySelector('[name="unit_cost"]')?.value,lot_code:row.querySelector('[name="lot_code"]')?.value,notes:row.querySelector('[name="line_notes"]')?.value}));const values=Object.fromEntries(new FormData(form).entries());try{const result=await lifecycleService.createGoodsReceipt({purchaseRequestId:values.purchase_request_id,warehouseId:values.warehouse_id,deliveryReference:values.delivery_reference,deliveryDate:values.delivery_date||null,notes:values.notes,lines});notify('Recepção criada em rascunho: '+(result.receipt_number||result.id)+'. O stock não foi alterado.');await renderProcurement();}catch(error){notify('Não foi possível guardar a recepção: '+(error?.message||'erro desconhecido'));}});
  root.querySelectorAll('[data-submit-request]').forEach(button=>button.addEventListener('click',async()=>{
    if(!procurementService)return;
    button.disabled=true;
    try{await procurementService.submitPurchaseRequest(button.dataset.submitRequest);notify('Pedido submetido à Administração para decisão.');await renderProcurement();}
    catch(error){button.disabled=false;notify('Não foi possível submeter o pedido: '+(error?.message||'erro desconhecido'));}
  }));
  root.querySelectorAll('[data-line-row]').forEach(row=>{
    row.querySelector('[data-remove-line]')?.addEventListener('click',()=>{
      const collection=row.parentElement;
      if(collection.children.length>1)row.remove();
      else row.querySelectorAll('input,select,textarea').forEach(input=>{if(input.name==='unit_of_measure')input.value='unidade';else if(input.name==='damaged_quantity'||input.name==='returned_quantity')input.value='0';else input.value='';});
    });
  });
  root.querySelectorAll('[data-add-line]').forEach(button=>button.addEventListener('click',()=>{
    const collection=button.closest('form')?.querySelector('[data-line-collection="'+button.dataset.addLine+'"]');
    const first=collection?.querySelector('[data-line-row]');
    if(!first)return;
    const clone=first.cloneNode(true);
    clone.querySelectorAll('input,select,textarea').forEach(input=>{if(input.name==='unit_of_measure')input.value='unidade';else if(input.name==='damaged_quantity'||input.name==='returned_quantity')input.value='0';else input.value='';});
    clone.querySelector('[data-remove-line]')?.addEventListener('click',()=>{if(collection.children.length>1)clone.remove();else clone.querySelectorAll('input,select,textarea').forEach(input=>{if(input.name==='unit_of_measure')input.value='unidade';else if(input.name==='damaged_quantity'||input.name==='returned_quantity')input.value='0';else input.value='';});});
    collection.appendChild(clone);
  }));
  root.querySelectorAll('[data-proc-form]').forEach(form=>form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!procurementService){notify('O perfil autenticado não tem permissões de gestão de aprovisionamento.');return;}
    const values=Object.fromEntries(new FormData(form).entries());
    if(form.dataset.procForm==='item')values.minimum_stock=Number(values.minimum_stock);
    try{
      if(form.dataset.procForm==='item')await procurementService.createItem(values);
      else if(form.dataset.procForm==='purchase-lines'){
        await procurementService.addPurchaseRequestLines(values.request_id,collectProcurementLineRows(form.querySelectorAll('[data-line-row]'),'purchase'));
      }
      else if(form.dataset.procForm==='purchase'){
        await procurementService.createPurchaseRequest({supplier_id:values.supplier_id||null,justification:values.justification,lines:collectProcurementLineRows(form.querySelectorAll('[data-line-row]'),'purchase')});
      }else if(form.dataset.procForm==='movement'){
        const id=await procurementService.postStockMovement(values);

      }else if(form.dataset.procForm==='transfer'){
        const result=await procurementService.transferStock(values);

      }else if(form.dataset.procForm==='count-lines'){
        await procurementService.addInventoryCountLines(values.count_id,collectProcurementLineRows(form.querySelectorAll('[data-line-row]'),'count'));
      }else if(form.dataset.procForm==='count'){
        await procurementService.createInventoryCount({warehouse_id:values.warehouse_id,notes:values.count_notes,lines:collectProcurementLineRows(form.querySelectorAll('[data-line-row]'),'count')});
      }
      else if(form.dataset.procForm==='supplier')await procurementService.createSupplier(values);
      else if(form.dataset.procForm==='warehouse')await procurementService.createWarehouse(values);
      if(form.dataset.procForm==='item')notify('Artigo criado com sucesso.');
      else if(form.dataset.procForm==='purchase-lines')notify('Linha adicionada ao pedido em rascunho.');
      else if(form.dataset.procForm==='purchase')notify('Pedido de aquisição guardado em rascunho.');
      else if(form.dataset.procForm==='movement')notify('Movimento de stock registado.');
      else if(form.dataset.procForm==='transfer')notify('Transferência concluída: saída e entrada registadas.');
      else if(form.dataset.procForm==='count-lines')notify('Artigo adicionado à contagem em rascunho.');
      else if(form.dataset.procForm==='count')notify('Contagem de inventário guardada em rascunho.');
      else if(form.dataset.procForm==='supplier')notify('Fornecedor criado com sucesso.');
      else if(form.dataset.procForm==='warehouse')notify('Armazém criado com sucesso.');
      await renderProcurement();
    }catch(error){const partial=error?.partialRequestNumber?' O cabeçalho do pedido '+error.partialRequestNumber+' foi criado; use o formulário de completar pedido com o ID '+error.partialRequestId+'.':error?.partialCountId?' A contagem foi criada em rascunho com o ID '+error.partialCountId+'.':'';notify('Não foi possível concluir a gravação: '+(error?.message||'erro desconhecido')+partial);}
  }));
}
async function loadDocumentEngine(){if(typeof window!=='undefined'&&window.CIADI_SUPPORT_DOCUMENT_ENGINE)return window.CIADI_SUPPORT_DOCUMENT_ENGINE;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='renderer/modules/support-document-engine.js';s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar o motor documental CIADI.'));document.head.appendChild(s);});if(!window.CIADI_SUPPORT_DOCUMENT_ENGINE)throw new Error('Motor documental CIADI indisponível.');return window.CIADI_SUPPORT_DOCUMENT_ENGINE;}
async function loadDocumentCatalog(){if(typeof window!=='undefined'&&window.CIADI_SUPPORT_DOCUMENT_CATALOG)return window.CIADI_SUPPORT_DOCUMENT_CATALOG;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='renderer/modules/support-document-catalog.js';s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar o catálogo documental CIADI.'));document.head.appendChild(s);});if(!window.CIADI_SUPPORT_DOCUMENT_CATALOG)throw new Error('Catálogo documental CIADI indisponível.');return window.CIADI_SUPPORT_DOCUMENT_CATALOG;}
async function renderDocuments(){
  const engine=await loadDocumentEngine();
  const catalog=await loadDocumentCatalog();
  const templates=engine.TEMPLATES;
  const motors=catalog.listMotors(),catalogItems=catalog.listDocuments();
  const formOptions=catalogItems.filter(item=>item.outputKind!=='dashboard').map(item=>({catalog:item,template:engine.createCatalogTemplate(item,item.legacyTemplateCode?templates.find(t=>t.code===item.legacyTemplateCode):null)}));
  root.innerHTML='<div class="card p-5"><div class="flex items-center justify-between gap-3 mb-5"><div><p class="text-xs font-black uppercase tracking-widest text-orange">Suporte Informática · CIADI</p><h2 class="text-2xl font-black">Motor Documental Institucional</h2><p class="text-sm text-slate-500">116 tipos catalogados em oito motores, com formulários padrão gerados por motor para os documentos e relatórios.</p></div><button id="documents-back" class="border rounded-xl px-3 py-2">Voltar</button></div><section class="grid md:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">'+motors.map(m=>'<details class="border rounded-xl p-3"><summary class="font-bold cursor-pointer">'+esc(m.title)+' <span class="text-xs text-slate-500">('+catalog.getDocumentsByMotor(m.id).length+')</span></summary><p class="text-xs text-slate-500 mt-2">'+esc(m.description)+'</p><ul class="text-xs mt-2 space-y-1">'+catalog.getDocumentsByMotor(m.id).map(d=>'<li>'+esc(d.code)+' — '+esc(d.title)+' <span class="text-amber-700">· '+(d.outputKind==='dashboard'?'painel / indicador':'formulário padrão do motor')+'</span></li>').join('')+'</ul></details>').join('')+'</section><div class="text-xs text-slate-500 mb-4">Catálogo: '+catalogItems.length+' tipos. Os documentos e relatórios usam formulários padrão por motor; os painéis e gráficos dependem de ligação aos dados operacionais.</div><section class="border rounded-xl p-4 mb-5"><div class="flex flex-wrap items-center justify-between gap-3 mb-3"><div><h3 class="font-black text-lg">Arquivo documental CIADI</h3><p class="text-xs text-slate-500">Pesquisa de rascunhos e documentos emitidos, com histórico de eventos.</p></div><button id="it-archive-refresh" class="border rounded-lg px-3 py-2 text-sm">Actualizar arquivo</button></div><div class="grid sm:grid-cols-2 gap-3 mb-3"><input id="it-archive-search" class="border rounded-lg p-2" type="search" placeholder="Pesquisar por título, referência ou código"><select id="it-archive-status" class="border rounded-lg p-2"><option value="all">Todos os estados</option><option value="draft">Rascunhos</option><option value="issued">Emitidos</option></select></div><div id="it-archive-summary" class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-3"></div><div id="it-archive-results" class="overflow-x-auto text-sm">A carregar arquivo documental…</div><div id="it-archive-history" class="mt-4"></div></section><label class="block text-sm font-bold mb-2" for="it-template">Tipo documental com formulário</label><select id="it-template" class="w-full border rounded-xl p-3 mb-4">'+formOptions.map((option,i)=>'<option value="'+i+'">'+esc(option.catalog.code)+' — '+esc(option.catalog.title)+'</option>').join('')+'</select><div id="it-document-fields" class="grid md:grid-cols-2 gap-4"></div><div class="flex flex-wrap gap-2 mt-5"><button id="it-document-preview" class="bg-orange text-white rounded-xl px-4 py-3 font-bold">Guardar rascunho e pré-visualizar</button><button id="it-document-issue" class="bg-slate-900 text-white rounded-xl px-4 py-3 font-bold" disabled>Emitir com QR Code</button><button id="it-document-print" class="border rounded-xl px-4 py-3" disabled>Exportar PDF</button><button id="it-document-send" class="border rounded-xl px-4 py-3 opacity-50" disabled>Enviar (canal por configurar)</button></div><div id="it-document-errors" class="text-sm text-red-700 mt-3"></div><div id="it-document-state" class="text-sm text-slate-500 mt-2">Ainda não foi criado qualquer documento.</div><section id="it-document-preview-area" class="mt-6"></section><p class="text-xs text-amber-700 mt-4">A emissão reserva número e QR no servidor antes de gerar o PDF final. O PDF é arquivado e emitido numa operação transaccional. O envio electrónico ainda depende da configuração e homologação de um canal institucional.</p></div>';
  const select=root.querySelector('#it-template'),fields=root.querySelector('#it-document-fields'),errors=root.querySelector('#it-document-errors'),preview=root.querySelector('#it-document-preview-area'),print=root.querySelector('#it-document-print'),issue=root.querySelector('#it-document-issue'),send=root.querySelector('#it-document-send'),state=root.querySelector('#it-document-state');
  let latestDraft=null,latestHtml='',latestValues=null,latestTemplate=null;
  const repository={
    async saveDraft(document){
      if(!supabase?.schema)throw new Error('Cliente Supabase indisponível.');
      const {data,error}=await supabase.schema('ciadi_ti').from('documents').insert({
        document_type_code:document.templateCode,
        title:document.title,
        payload:{templateCode:document.templateCode,templateVersion:document.templateVersion,values:document.values}
      }).select('id,document_type_code,title,status,created_at,created_by').single();
      if(error)throw error;
      return data;
    },
    async listDocuments(){
      if(!supabase?.schema)throw new Error('Cliente Supabase indisponível.');
      const {data,error}=await supabase.schema('ciadi_ti').from('documents')
        .select('id,document_type_code,title,status,document_number,created_at,created_by,issued_at')
        .order('created_at',{ascending:false}).limit(200);
      if(error)throw error;
      return data||[];
    },
    async listDocumentEvents(documentId){
      if(!supabase?.schema)throw new Error('Cliente Supabase indisponível.');
      const {data,error}=await supabase.schema('ciadi_ti').from('document_events')
        .select('id,event_type,actor_id,details,occurred_at')
        .eq('document_id',documentId).order('occurred_at',{ascending:true}).limit(200);
      if(error)throw error;
      return data||[];
    },
    async prepareIssuance(documentId){
      const {data,error}=await supabase.functions.invoke('ciadi-ti-prepare-document',{body:{document_id:documentId}});
      if(error)throw error;
      const token=new URL(data.verificationUrl).searchParams.get('token');
      return {...data,number:data.documentNumber,token};
    },
    async finalizeIssuance({documentId,token,artifact}){
      const form=new FormData();
      form.append('document_id',documentId);
      form.append('verification_token',token);
      form.append('file',new Blob([artifact.bytes],{type:'application/pdf'}),artifact.filename);
      const {data,error}=await supabase.functions.invoke('ciadi-ti-issue-document',{body:form});
      if(error)throw error;
      return data;
    }
    ,
    async downloadIssuedPdf(documentId){
      const {data:record,error:recordError}=await supabase.schema('ciadi_ti').from('documents')
        .select('id,status,document_number,storage_path,mime_type')
        .eq('id',documentId).single();
      if(recordError)throw recordError;
      if(!record||record.status!=='issued'||!record.storage_path)throw new Error('O documento não está emitido ou não tem PDF oficial arquivado.');
      const {data,error}=await supabase.storage.from('ciadi-ti-documentos').download(record.storage_path);
      if(error)throw error;
      if(!data)throw new Error('PDF oficial não encontrado no arquivo privado.');
      return {
        bytes:new Uint8Array(await data.arrayBuffer()),
        mimeType:record.mime_type||data.type||'application/pdf',
        filename:(record.document_number||documentId)+'.pdf'
      };
    }
  };
  const pdfRenderer=async({html,filename})=>{
    const desktop=window.ciadiDesktop?.documents;
    if(!desktop?.renderPdf)throw new Error('A geração do PDF final exige a aplicação CIADI Desktop.');
    const rendered=await desktop.renderPdf({html});
    let bytes;
    if(rendered instanceof Uint8Array)bytes=rendered;
    else if(Array.isArray(rendered))bytes=Uint8Array.from(rendered);
    else if(rendered?.data&&Array.isArray(rendered.data))bytes=Uint8Array.from(rendered.data);
    else throw new Error('O serviço Desktop não devolveu os bytes do PDF.');
    return {bytes,mimeType:'application/pdf',filename};
  };
  const pdfExporter=async({bytes,filename,documentId,mimeType})=>{
    const desktop=window.ciadiDesktop?.documents;
    if(!desktop?.exportIssuedPdf)throw new Error('Exportação PDF disponível apenas na aplicação CIADI Desktop.');
    return desktop.exportIssuedPdf({document:{id:documentId,status:'issued'},bytes,mimeType,filename});
  };
  const service=engine.createDocumentService({repository,pdfRenderer,pdfExporter});
  const archiveSearch=root.querySelector('#it-archive-search');
  const archiveStatus=root.querySelector('#it-archive-status');
  const archiveSummary=root.querySelector('#it-archive-summary');
  const archiveResults=root.querySelector('#it-archive-results');
  const archiveHistory=root.querySelector('#it-archive-history');
  let archiveRows=[];
  function drawArchive(){
    const filtered=engine.filterDocumentArchive(archiveRows,{query:archiveSearch.value,status:archiveStatus.value});
    const summary=engine.summarizeDocumentArchive(archiveRows);
    archiveSummary.innerHTML=[['Total',summary.total],['Rascunhos',summary.drafts],['Emitidos',summary.issued],['Outros estados',summary.other]]
      .map(([label,value])=>'<article class="border rounded-lg p-2"><small class="text-slate-500">'+label+'</small><div class="text-xl font-black">'+value+'</div></article>').join('');
    archiveResults.innerHTML=filtered.length
      ? '<table class="w-full min-w-[680px]"><thead><tr class="text-left border-b"><th class="py-2">Referência</th><th>Documento</th><th>Estado</th><th>Data</th><th>Acções</th></tr></thead><tbody>'+filtered.map(row=>'<tr class="border-b"><td class="py-2 font-bold">'+esc(row.document_number||'RASCUNHO')+'</td><td>'+esc(row.title)+'<div class="text-xs text-slate-500">'+esc(row.document_type_code)+'</div></td><td>'+esc(row.status)+'</td><td>'+esc(row.created_at||'')+'</td><td class="whitespace-nowrap"><button data-doc-history="'+esc(row.id)+'" class="border rounded px-2 py-1 mr-1">Histórico</button>'+(row.status==='issued'?'<button data-doc-export="'+esc(row.id)+'" class="border rounded px-2 py-1">PDF</button>':'')+'</td></tr>').join('')+'</tbody></table>'
      : '<p class="text-sm text-slate-500 py-3">Não foram encontrados documentos para estes filtros.</p>';
  }
  async function refreshArchive(){
    archiveResults.textContent='A consultar o arquivo documental…';
    try{archiveRows=await repository.listDocuments();drawArchive();}
    catch(error){archiveRows=[];archiveSummary.innerHTML='';archiveResults.innerHTML='<p class="text-amber-700">Não foi possível consultar o arquivo: '+esc(error?.message||'erro desconhecido')+'</p>';}
  }
  archiveSearch.addEventListener('input',drawArchive);
  archiveStatus.addEventListener('change',drawArchive);
  root.querySelector('#it-archive-refresh').addEventListener('click',refreshArchive);
  archiveResults.addEventListener('click',async event=>{
    const historyButton=event.target.closest('[data-doc-history]');
    const exportButton=event.target.closest('[data-doc-export]');
    if(historyButton){
      const id=historyButton.dataset.docHistory;
      archiveHistory.textContent='A consultar histórico…';
      try{
        const events=await repository.listDocumentEvents(id);
        archiveHistory.innerHTML='<section class="border rounded-xl p-4"><h4 class="font-bold mb-2">Histórico do documento</h4>'+(events.length?'<ol class="space-y-2">'+events.map(item=>'<li class="border-l-2 border-orange pl-3"><b>'+esc(item.event_type)+'</b><div class="text-xs text-slate-500">'+esc(item.occurred_at||'')+' · '+esc(item.actor_id||'Sistema')+'</div><pre class="text-xs whitespace-pre-wrap mt-1">'+esc(JSON.stringify(item.details||{}))+'</pre></li>').join('')+'</ol>':'<p class="text-sm text-slate-500">Ainda não existem eventos registados.</p>')+'</section>';
      }catch(error){archiveHistory.innerHTML='<p class="text-amber-700">Não foi possível consultar o histórico: '+esc(error?.message||'erro desconhecido')+'</p>';}
      return;
    }
    if(exportButton){
      const row=archiveRows.find(item=>item.id===exportButton.dataset.docExport);
      if(!row||row.status!=='issued')return;
      exportButton.disabled=true;
      try{
        const filename=String(row.document_number||row.id).replace(/[^A-Za-z0-9_-]/g,'_')+'.pdf';
        const result=await service.exportIssuedPdf({id:row.id,status:row.status,number:row.document_number},filename);
        notify(result?.saved?'PDF oficial exportado.':result?.cancelled?'Exportação cancelada.':'Pedido de exportação concluído.');
      }catch(error){notify('Não foi possível exportar o PDF: '+(error?.message||'erro desconhecido'));}
      finally{exportButton.disabled=false;}
    }
  });

  function drawFields(){
    const t=formOptions[Number(select.value)]?.template;
    if(!t){fields.innerHTML='<p class="text-amber-700">Não foi possível carregar o formulário seleccionado.</p>';return;}
    fields.innerHTML=t.fields.map(f=>'<label class="block text-sm font-semibold">'+esc(f.label)+(f.required?' *':'')+(f.type==='textarea'?'<textarea data-field="'+esc(f.key)+'" class="block w-full border rounded-xl p-3 mt-1" rows="3"></textarea>':f.type==='select'?'<select data-field="'+esc(f.key)+'" class="block w-full border rounded-xl p-3 mt-1"><option value="">Seleccionar…</option>'+f.options.map(o=>'<option value="'+esc(o)+'">'+esc(o)+'</option>').join('')+'</select>':'<input data-field="'+esc(f.key)+'" type="'+(f.type==='number'?'number':f.type==='date'?'date':'text')+'" '+(f.type==='number'?'min="0" step="any"':'')+' class="block w-full border rounded-xl p-3 mt-1">')+'</label>').join('');
    errors.textContent='';preview.innerHTML='';latestHtml='';latestDraft=null;latestValues=null;latestTemplate=null;root.querySelector('#it-document-preview').disabled=false;issue.disabled=true;print.disabled=true;send.disabled=true;
    state.textContent='Preencha os campos obrigatórios para guardar um rascunho.';
  }
  select.addEventListener('change',drawFields);
  drawFields();
  refreshArchive();
  root.querySelector('#documents-back').addEventListener('click',()=>renderHome().catch(e=>notify(e.message)));
  root.querySelector('#it-document-preview').addEventListener('click',async()=>{
    const t=formOptions[Number(select.value)]?.template,values={};
    if(!t){errors.textContent='Seleccione um tipo documental válido.';return;}
    fields.querySelectorAll('[data-field]').forEach(el=>values[el.dataset.field]=el.value);
    const auth=await supabase?.auth?.getUser?.();const actorId=auth?.data?.user?.id||'';
    const created=engine.createDocumentDraft({templateCode:t.code,templateDefinition:t,values,actorId});
    if(!created.ok){errors.textContent=created.errors.join(' ');preview.innerHTML='';latestHtml='';latestDraft=null;issue.disabled=true;print.disabled=true;return;}
    try{
      const saved=await service.save(created.document);
      latestDraft={...created.document,id:saved.id,createdAt:saved.created_at||created.document.createdAt,status:'draft'};
      latestValues=values;latestTemplate=t;
      latestHtml=engine.renderDocumentHtml({template:t,values,metadata:{number:'RASCUNHO — SEM NUMERAÇÃO OFICIAL',createdAt:latestDraft.createdAt,status:'Não emitido'}});
      preview.innerHTML='<div class="overflow-auto rounded-xl bg-slate-100 p-3"><div class="mx-auto bg-white shadow-xl" style="max-width:210mm">'+latestHtml+'</div></div>';
      errors.textContent='';state.textContent='Rascunho guardado no arquivo CIADI. Referência: '+saved.id;
      root.querySelector('#it-document-preview').disabled=true;issue.disabled=false;print.disabled=true;send.disabled=true;
    }catch(e){errors.textContent='Não foi possível guardar o rascunho: '+(e?.message||'erro desconhecido');state.textContent='O documento não foi confirmado no arquivo.';issue.disabled=true;}
  });
  issue.addEventListener('click',async()=>{
    if(!latestDraft||latestDraft.status!=='draft')return;
    issue.disabled=true;errors.textContent='';state.textContent='A reservar o número, preparar o QR e gerar o PDF final…';
    try{
      const filenameHint='documento-ciadi.pdf';
      const result=await service.issue(latestDraft.id,{
        filename:filenameHint,
        renderHtml:async({number,verificationUrl,qrDataUrl})=>engine.renderDocumentHtml({
          template:latestTemplate,
          values:latestValues,
          metadata:{number,createdAt:latestDraft.createdAt,status:'Emitido'},
          qrDataUrl
        })
      });
      latestDraft={...latestDraft,status:'issued',number:result.document.number};
      latestHtml=result.html;
      preview.innerHTML='<div class="overflow-auto rounded-xl bg-slate-100 p-3"><div class="mx-auto bg-white shadow-xl" style="max-width:210mm">'+latestHtml+'</div></div>';
      state.textContent='Documento emitido e arquivado: '+result.document.number;
      print.disabled=false;issue.disabled=true;send.disabled=true;
      notify('Documento emitido com QR Code de autenticação.');
    }catch(e){
      errors.textContent='A emissão não foi confirmada: '+(e?.message||'erro desconhecido');
      state.textContent='O rascunho permanece no arquivo. Se a sessão QR expirou, prepare uma nova emissão.';
      issue.disabled=false;
    }
  });
  print.addEventListener('click',async()=>{
    if(!latestDraft||latestDraft.status!=='issued')return;
    try{
      const filename=String(latestDraft.number||'documento-ciadi').replace(/[^A-Za-z0-9_-]/g,'_')+'.pdf';
      const result=await service.exportIssuedPdf(latestDraft,filename);
      if(result?.cancelled)state.textContent='Exportação cancelada pelo utilizador.';
      else if(result?.saved)state.textContent='PDF oficial arquivado exportado para: '+result.filePath;
    }catch(e){errors.textContent='Não foi possível exportar o PDF oficial: '+(e?.message||'erro desconhecido');}
  });
  send.addEventListener('click',()=>notify('O canal de envio institucional ainda não está configurado; nenhum documento foi enviado.'));
}
return Object.freeze({renderHome,loadAudit});}return Object.freeze({normalizeStatus,aggregateAudit,validateDocumentModel,summarizeProcurement,summarizeStockMovements,summarizeStockBalances,summarizeStockAlerts,collectProcurementLineRows,createProcurementService,create});});