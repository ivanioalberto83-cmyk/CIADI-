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
function validateDocumentModel(m){const errors=[];if(!m||typeof m.code!=='string'||!/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(m.code))errors.push('Código documental inválido.');if(!Number.isInteger(m?.version)||m.version<1)errors.push('Versão inválida.');if(!Array.isArray(m?.fields)||!m.fields.length)errors.push('O modelo deve ter campos.');const keys=new Set();for(const f of m?.fields||[]){if(!f||typeof f.key!=='string'||!/^[a-z][a-z0-9_]{1,39}$/.test(f.key))errors.push('Identificador de campo inválido.');else if(keys.has(f.key))errors.push('Identificador de campo repetido.');else keys.add(f.key);}return{valid:!errors.length,errors};}
function summarizeProcurement(rows){const a=Array.isArray(rows)?rows:[];return{total:a.length,pending:a.filter(x=>['submitted','returned'].includes(String(x.status).toLowerCase())).length,submitted:a.filter(x=>String(x.status).toLowerCase()==='submitted').length,returned:a.filter(x=>String(x.status).toLowerCase()==='returned').length,approved:a.filter(x=>String(x.status).toLowerCase()==='approved').length,rejected:a.filter(x=>String(x.status).toLowerCase()==='rejected').length,received:a.filter(x=>String(x.status).toLowerCase()==='received').length};}

function createProcurementService({db,role}={}){
  if(!db?.from)throw new Error('Cliente de dados do aprovisionamento obrigatório.');
  const allowedRoles=new Set(['suporte_informatica']);
  function ensureRole(){if(!allowedRoles.has(String(role||'').toLowerCase()))throw new Error('Perfil sem autorização para gerir o aprovisionamento.');}
  function pick(source,keys){const out={};for(const key of keys)if(source&&source[key]!==undefined)out[key]=source[key];return out;}
  async function insertOne(table,payload){const result=await db.from(table).insert(payload).select().single();if(result?.error)throw result.error;if(!result?.data)throw new Error('A base de dados não devolveu o registo criado.');return result;}
  return Object.freeze({
    async createItem(input){ensureRole();const p=pick(input,['sku','name','description','category_id','item_type','tracking_mode','unit_of_measure','brand','model','minimum_stock','active','notes']);const validTypes=['equipamento','peca','consumivel','licenca','servico'];const validTracking=['serialized','lot','quantity'];if(!String(p.sku||'').trim()||!String(p.name||'').trim()||!validTypes.includes(p.item_type)||!validTracking.includes(p.tracking_mode)||!Number.isFinite(Number(p.minimum_stock??0))||Number(p.minimum_stock??0)<0)throw new Error('Dados do artigo inválidos.');p.sku=String(p.sku).trim();p.name=String(p.name).trim();p.minimum_stock=Number(p.minimum_stock??0);return insertOne('items',p);},
    async createSupplier(input){ensureRole();const p=pick(input,['name','nif','contact_name','email','phone','address','notes','active']);if(!String(p.name||'').trim())throw new Error('Nome do fornecedor obrigatório.');p.name=String(p.name).trim();return insertOne('suppliers',p);},
    async createWarehouse(input){ensureRole();const p=pick(input,['code','name','polo','location_description','active']);if(!String(p.code||'').trim()||!String(p.name||'').trim())throw new Error('Código e nome do armazém são obrigatórios.');p.code=String(p.code).trim();p.name=String(p.name).trim();return insertOne('warehouses',p);}
  });
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function bars(rows){if(!rows.length)return'<p class="text-sm text-slate-500">Sem registos disponíveis.</p>';const max=Math.max(1,...rows.map(x=>x.value));return'<div class="space-y-3">'+rows.map(x=>'<div><div class="flex justify-between text-xs mb-1"><span>'+esc(x.label)+'</span><b>'+x.value+'</b></div><div class="h-2 rounded-full bg-slate-100"><div class="h-2 rounded-full bg-orange" style="width:'+Math.round(x.value/max*100)+'%"></div></div></div>').join('')+'</div>';}
function create({root,supabase,navigate=()=>{},notify=()=>{},stationLabel='Suporte Informática'}={}){if(!root)throw new Error('Contentor do módulo obrigatório.');async function loadAudit(){if(!supabase?.from)return{rows:[],error:new Error('Supabase indisponível.')};const r=await supabase.from('auditoria').select('id,acao,tabela,created_at').order('created_at',{ascending:false}).limit(300);return{rows:r.data||[],error:r.error||null};}async function renderHome(){root.innerHTML='<div class="card p-6">A carregar o Centro de Operações de TI…</div>';let a;try{a=await loadAudit();}catch(e){a={rows:[],error:e};}let documentCatalog=null;try{documentCatalog=await loadDocumentCatalog();}catch(e){}const stats=aggregateAudit(a.rows);const services=[['Aplicação CIADI',{}],['Supabase',{}],['Rede institucional',{}],['Backups e recuperação',{}],['Sites e plataformas',{}]];const verifiedServices=services.filter(([,status])=>normalizeStatus(status)!=='Por verificar').length;root.innerHTML='<div class="mb-5"><span class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Tecnologia e Sistemas</span><h2 class="text-3xl font-black mt-1">Centro de Operações de TI</h2><p class="text-slate-500">Monitorização, assistência interna, aprovisionamento técnico e controlo documental.</p><span class="text-xs text-slate-500">Estação: '+esc(stationLabel)+'</span></div><div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-4"><article class="card p-5"><div class="text-sm text-slate-500">Registos de auditoria lidos</div><div class="text-3xl font-black">'+stats.total+'</div><small>Últimos 300 registos consultados</small></article><article class="card p-5"><div class="text-sm text-slate-500">Serviços verificados</div><div class="text-3xl font-black">'+verifiedServices+' / '+services.length+'</div><small>Os restantes aguardam integração</small></article><article class="card p-5"><div class="text-sm text-slate-500">Modelos documentais</div><div class="text-3xl font-black">'+(documentCatalog?documentCatalog.listDocuments().length:0)+'</div><small>'+(documentCatalog?'tipos catalogados em oito motores':'Catálogo indisponível')+'</small></article><article class="card p-5"><div class="text-sm text-slate-500">Aprovisionamento técnico</div><div class="text-2xl font-black">Por verificar</div><small>Esquema de dados por confirmar</small></article></div><div class="grid xl:grid-cols-2 gap-5 mt-5"><section class="card p-5"><div class="flex justify-between mb-4"><h3 class="font-black text-lg">Estado dos serviços</h3><button id="support-refresh" class="border rounded-xl px-3 py-2 text-sm">Actualizar</button></div>'+services.map(([n,c])=>'<div class="flex justify-between border-b py-3"><b>'+n+'</b><span class="text-xs font-bold">'+normalizeStatus(c)+'</span></div>').join('')+'<p class="text-xs text-slate-400 mt-3">Sem evidência, o estado permanece Por verificar.</p></section><section class="card p-5"><h3 class="font-black text-lg mb-4">Auditoria • Acções</h3>'+(a.error?'<p class="text-amber-700">Erro ao consultar auditoria: '+esc(a.error.message)+'</p>':bars(stats.byAction.slice(0,7)))+'</section></div><div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-5"><button data-helpdesk class="card p-5 text-left"><b>Helpdesk e incidentes</b><p class="text-sm text-slate-500 mt-2">Chamados, assistência, incidentes e histórico técnico.</p></button><button data-go="auditoria" class="card p-5 text-left"><b>Auditoria e relatórios</b><p class="text-sm text-slate-500 mt-2">Registos e análises.</p></button><button data-procurement class="card p-5 text-left"><b>Aprovisionamento informático</b><p class="text-sm text-slate-500 mt-2">Consultar inventário, equipamentos, fornecedores, armazéns e pedidos de aquisição.</p></button><button data-documents class="card p-5 text-left"><b>Motores documentais</b><p class="text-sm text-slate-500 mt-2">Modelos técnicos, validação e pré-visualização para impressão.</p></button><article class="card p-5"><b>Inventário e manutenção</b><p class="text-sm text-slate-500 mt-2">Equipamentos e intervenções técnicas.</p></article><article class="card p-5"><b>Segurança e backups</b><p class="text-sm text-slate-500 mt-2">Incidentes e evidências de recuperação.</p></article></div>';root.querySelector('#support-refresh')?.addEventListener('click',()=>renderHome().catch(e=>notify(e.message)));root.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));root.querySelector('[data-documents]')?.addEventListener('click',()=>renderDocuments().catch(e=>notify(e.message)));root.querySelector('[data-procurement]')?.addEventListener('click',()=>renderProcurement().catch(e=>notify(e.message)));root.querySelector('[data-helpdesk]')?.addEventListener('click',()=>renderHelpdesk().catch(e=>notify(e.message)));}async function renderHelpdesk(){const module=globalThis.CIADI_SUPPORT_HELPDESK;if(!module){root.innerHTML='<div class="card p-5">Módulo Helpdesk indisponível nesta versão.</div>';return;}await module.create({root,supabase,notify,onBack:renderHome}).render();}async function renderProcurement(){
  root.innerHTML='<div class="card p-5">A consultar o Aprovisionamento Informático…</div>';
  if(!supabase?.schema){root.innerHTML='<div class="card p-5"><h2 class="text-xl font-black">Aprovisionamento Informático</h2><p class="text-amber-700 mt-2">O cliente Supabase não disponibiliza acesso ao schema ciadi_ti. Não foram feitas alterações.</p><button id="proc-back" class="border rounded-xl px-3 py-2 mt-4">Voltar</button></div>';root.querySelector('#proc-back').onclick=()=>renderHome();return;}
  const db=supabase.schema('ciadi_ti');
  let actorRole=null;
  try{
    const auth=await supabase.auth?.getUser?.();
    const user=auth?.data?.user;
    if(user?.id){const profile=await supabase.from('perfis').select('tipo').eq('id',user.id).maybeSingle();if(!profile.error)actorRole=profile.data?.tipo||null;}
  }catch(_error){actorRole=null;}
  const canManage=String(actorRole||'').toLowerCase()==='suporte_informatica';
  const procurementService=canManage?createProcurementService({db,role:actorRole}):null;
  const specs=[
    ['items','id,sku,name,item_type,tracking_mode,minimum_stock,active','name'],
    ['assets','id,item_id,serial_number,asset_tag,status,acquired_at,warranty_until','created_at'],
    ['suppliers','id,name,nif,email,phone,active','name'],
    ['warehouses','id,code,name,polo,active','name'],
    ['purchase_requests','id,request_number,status,justification,estimated_total,created_at','created_at'],
    ['stock_movements','id,item_id,warehouse_id,movement_type,quantity_delta,unit_cost,lot_code,reference,notes,created_at','created_at'],
    ['inventory_counts','id,warehouse_id,status,counted_by,reconciled_by,counted_at,reconciled_at,notes,created_at','created_at'],
    ['audit_events','id,table_name,record_id,action,actor_id,occurred_at','occurred_at']
  ];
  const results=await Promise.all(specs.map(async([table,columns,order])=>{try{const q=await db.from(table).select(columns).order(order,{ascending:false}).limit(100);return{table,rows:q.data||[],error:q.error};}catch(error){return{table,rows:[],error};}}));
  let balances={rows:[],error:null};
  try{const q=await db.from('stock_balances').select('*').limit(100);balances={rows:q.data||[],error:q.error||null};}catch(error){balances={rows:[],error};}
  const by=Object.fromEntries(results.map(x=>[x.table,x]));
  const errors=[...results.filter(x=>x.error),...(balances.error?[{table:'stock_balances',error:balances.error}]:[])];
  const items=by.items.rows,assets=by.assets.rows,requests=by.purchase_requests.rows,movements=by.stock_movements.rows;
  const metrics=summarizeProcurement(requests),movementStats=summarizeStockMovements(movements);
  const count=(name)=>by[name].rows.length;
  const table=(title,rows,cols)=>'<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">'+title+'</h3>'+(rows.length?'<div class="overflow-auto"><table class="w-full text-sm"><thead><tr class="border-b text-left">'+cols.map(x=>'<th class="p-2">'+x[1]+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr class="border-b">'+cols.map(x=>'<td class="p-2">'+esc(row[x[0]]??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<p class="text-sm text-slate-500">Sem registos disponíveis.</p>')+'</section>';
  const dynamicTable=(title,rows)=>{const cols=rows.length?Object.keys(rows[0]):[];return '<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">'+title+'</h3>'+(rows.length?'<div class="overflow-auto"><table class="w-full text-sm"><thead><tr class="border-b text-left">'+cols.map(x=>'<th class="p-2">'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr class="border-b">'+cols.map(x=>'<td class="p-2">'+esc(row[x]??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<p class="text-sm text-slate-500">Sem saldos disponíveis na vista stock_balances.</p>')+'</section>';};
  const forms=canManage
    ? '<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">Registar no catálogo</h3><div class="grid xl:grid-cols-3 gap-4">'+
      '<form data-proc-form="item" class="border rounded-xl p-4 space-y-2"><b>Novo artigo</b><input name="sku" required placeholder="Referência / SKU" class="w-full border rounded-lg p-2"><input name="name" required placeholder="Designação" class="w-full border rounded-lg p-2"><select name="item_type" required class="w-full border rounded-lg p-2"><option value="equipamento">Equipamento</option><option value="peca">Peça</option><option value="consumivel">Consumível</option><option value="licenca">Licença</option><option value="servico">Serviço</option></select><select name="tracking_mode" required class="w-full border rounded-lg p-2"><option value="quantity">Por quantidade</option><option value="serialized">Por número de série</option><option value="lot">Por lote</option></select><input name="minimum_stock" type="number" min="0" step="0.01" value="0" required placeholder="Stock mínimo" class="w-full border rounded-lg p-2"><button class="bg-orange text-white rounded-lg px-3 py-2 font-bold" type="submit">Guardar artigo</button></form>'+
      '<form data-proc-form="supplier" class="border rounded-xl p-4 space-y-2"><b>Novo fornecedor</b><input name="name" required placeholder="Nome / firma" class="w-full border rounded-lg p-2"><input name="nif" placeholder="NIF" class="w-full border rounded-lg p-2"><input name="email" type="email" placeholder="Email" class="w-full border rounded-lg p-2"><input name="phone" placeholder="Telefone" class="w-full border rounded-lg p-2"><button class="bg-orange text-white rounded-lg px-3 py-2 font-bold" type="submit">Guardar fornecedor</button></form>'+
      '<form data-proc-form="warehouse" class="border rounded-xl p-4 space-y-2"><b>Novo armazém</b><input name="code" required placeholder="Código" class="w-full border rounded-lg p-2"><input name="name" required placeholder="Designação" class="w-full border rounded-lg p-2"><input name="polo" placeholder="Polo / centro" class="w-full border rounded-lg p-2"><input name="location_description" placeholder="Localização" class="w-full border rounded-lg p-2"><button class="bg-orange text-white rounded-lg px-3 py-2 font-bold" type="submit">Guardar armazém</button></form></div><p class="text-xs text-slate-500 mt-3">A gravação depende das políticas RLS e das permissões efectivas do utilizador. Nenhuma aprovação financeira é disponibilizada nesta estação.</p></section>'
    : '<section class="card p-4 mt-5"><b>Modo de consulta</b><p class="text-sm text-slate-500 mt-1">O perfil autenticado não foi identificado como Suporte Informática, Administração ou Gestão. Não são apresentados controlos de gravação.</p></section>';
  root.innerHTML='<div class="mb-4 flex items-center justify-between gap-3"><div><p class="text-xs font-black uppercase tracking-widest text-orange">Suporte Informática</p><h2 class="text-2xl font-black">Aprovisionamento Informático</h2><p class="text-sm text-slate-500">Consulta do schema ciadi_ti, com gestão controlada do catálogo e análise do histórico. Os movimentos transaccionais aguardam confirmação do contrato RPC.</p></div><button id="proc-back" class="border rounded-xl px-3 py-2">Voltar</button></div>'+
  '<div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-4"><article class="card p-4"><small>Artigos activos</small><div class="text-3xl font-black">'+items.filter(x=>x.active).length+'</div></article><article class="card p-4"><small>Equipamentos</small><div class="text-3xl font-black">'+assets.length+'</div></article><article class="card p-4"><small>Fornecedores activos</small><div class="text-3xl font-black">'+by.suppliers.rows.filter(x=>x.active).length+'</div></article><article class="card p-4"><small>Pedidos pendentes</small><div class="text-3xl font-black">'+metrics.pending+'</div></article></div>'+
  forms+'<section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">Movimentos de stock • análise</h3><div class="grid sm:grid-cols-3 gap-3 mb-4"><article class="rounded-xl border p-3"><small>Movimentos carregados</small><div class="text-2xl font-black">'+movementStats.total+'</div></article><article class="rounded-xl border p-3"><small>Soma líquida das quantidades</small><div class="text-2xl font-black">'+movementStats.netQuantity+'</div></article><article class="rounded-xl border p-3"><small>Registos com quantidade válida</small><div class="text-2xl font-black">'+movementStats.knownQuantities+'</div></article></div><div class="grid xl:grid-cols-2 gap-5"><div><h4 class="font-bold mb-3">Movimentos por tipo</h4>'+bars(movementStats.byType)+'</div><div><h4 class="font-bold mb-3">Movimentos por dia</h4>'+bars(movementStats.byDay)+'</div></div><p class="text-xs text-slate-500 mt-3">Análise da amostra carregada (até 100 movimentos); a soma líquida não representa o saldo contabilístico global.</p></section><section class="card p-5 mt-5"><h3 class="font-black text-lg mb-3">Pedidos de aquisição</h3><div class="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm"><div>Submetidos: <b>'+metrics.submitted+'</b></div><div>Devolvidos: <b>'+metrics.returned+'</b></div><div>Aprovados: <b>'+metrics.approved+'</b></div><div>Rejeitados: <b>'+metrics.rejected+'</b></div><div>Recebidos: <b>'+metrics.received+'</b></div></div><p class="text-xs text-slate-500 mt-3">O Suporte pode acompanhar e preparar pedidos; a decisão financeira continua reservada à Administração.</p></section>'+
  table('Catálogo de artigos',items,[['sku','Referência'],['name','Artigo'],['item_type','Tipo'],['tracking_mode','Rastreio'],['minimum_stock','Stock mínimo'],['active','Activo']])+
  table('Equipamentos individualizados',assets,[['asset_tag','Património'],['serial_number','N.º série'],['item_id','Artigo (ID)'],['status','Estado'],['warranty_until','Garantia até']])+
  table('Fornecedores',by.suppliers.rows,[['name','Fornecedor'],['nif','NIF'],['email','Email'],['phone','Telefone'],['active','Activo']])+
  table('Armazéns',by.warehouses.rows,[['code','Código'],['name','Armazém'],['polo','Polo'],['active','Activo']])+
  dynamicTable('Saldos de stock por artigo e armazém',balances.rows)+
  table('Movimentos de stock',movements,[['created_at','Data'],['movement_type','Movimento'],['item_id','Artigo (ID)'],['warehouse_id','Armazém (ID)'],['quantity_delta','Variação'],['reference','Referência']])+
  table('Contagens de inventário',by.inventory_counts.rows,[['created_at','Criada em'],['warehouse_id','Armazém (ID)'],['status','Estado'],['counted_at','Contada em'],['reconciled_at','Reconciliada em']])+
  table('Eventos de auditoria do inventário',by.audit_events.rows,[['occurred_at','Data'],['table_name','Tabela'],['action','Acção'],['record_id','Registo']])+
  table('Pedidos de aquisição',requests,[['request_number','N.º pedido'],['status','Estado'],['justification','Justificação'],['estimated_total','Estimativa']])+
  (errors.length?'<div class="card p-4 mt-5 border border-amber-300"><b>Consultas com erro</b><ul class="list-disc pl-5 text-sm">'+errors.map(x=>'<li>'+esc(x.table)+': '+esc(x.error?.message||'Erro de consulta')+'</li>').join('')+'</ul></div>':'')+
  '<p class="text-xs text-slate-400 mt-4">Consultas limitadas aos 100 registos mais recentes/ordenados por tabela. Os totais apresentados correspondem à amostra carregada, não a contagens globais. Nenhum registo foi criado ou alterado.</p>';
  root.querySelector('#proc-back').addEventListener('click',()=>renderHome().catch(e=>notify(e.message)));
  root.querySelectorAll('[data-proc-form]').forEach(form=>form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!procurementService){notify('O perfil autenticado não tem permissões de gestão de aprovisionamento.');return;}
    const values=Object.fromEntries(new FormData(form).entries());
    if(form.dataset.procForm==='item')values.minimum_stock=Number(values.minimum_stock);
    try{
      if(form.dataset.procForm==='item')await procurementService.createItem(values);
      else if(form.dataset.procForm==='supplier')await procurementService.createSupplier(values);
      else if(form.dataset.procForm==='warehouse')await procurementService.createWarehouse(values);
      notify('Registo criado com sucesso.');
      await renderProcurement();
    }catch(error){notify('Não foi possível gravar: '+(error?.message||'erro desconhecido'));}
  }));
}
async function loadDocumentEngine(){if(typeof window!=='undefined'&&window.CIADI_SUPPORT_DOCUMENT_ENGINE)return window.CIADI_SUPPORT_DOCUMENT_ENGINE;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='renderer/modules/support-document-engine.js';s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar o motor documental CIADI.'));document.head.appendChild(s);});if(!window.CIADI_SUPPORT_DOCUMENT_ENGINE)throw new Error('Motor documental CIADI indisponível.');return window.CIADI_SUPPORT_DOCUMENT_ENGINE;}
async function loadDocumentCatalog(){if(typeof window!=='undefined'&&window.CIADI_SUPPORT_DOCUMENT_CATALOG)return window.CIADI_SUPPORT_DOCUMENT_CATALOG;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='renderer/modules/support-document-catalog.js';s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar o catálogo documental CIADI.'));document.head.appendChild(s);});if(!window.CIADI_SUPPORT_DOCUMENT_CATALOG)throw new Error('Catálogo documental CIADI indisponível.');return window.CIADI_SUPPORT_DOCUMENT_CATALOG;}
async function renderDocuments(){
  const engine=await loadDocumentEngine();
  const catalog=await loadDocumentCatalog();
  const templates=engine.TEMPLATES;
  const motors=catalog.listMotors(),catalogItems=catalog.listDocuments();
  root.innerHTML='<div class="card p-5"><div class="flex items-center justify-between gap-3 mb-5"><div><p class="text-xs font-black uppercase tracking-widest text-orange">Suporte Informática · CIADI</p><h2 class="text-2xl font-black">Motor Documental Institucional</h2><p class="text-sm text-slate-500">116 tipos catalogados em oito motores; dez modelos-base com formulário funcional.</p></div><button id="documents-back" class="border rounded-xl px-3 py-2">Voltar</button></div><section class="grid md:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">'+motors.map(m=>'<details class="border rounded-xl p-3"><summary class="font-bold cursor-pointer">'+esc(m.title)+' <span class="text-xs text-slate-500">('+catalog.getDocumentsByMotor(m.id).length+')</span></summary><p class="text-xs text-slate-500 mt-2">'+esc(m.description)+'</p><ul class="text-xs mt-2 space-y-1">'+catalog.getDocumentsByMotor(m.id).map(d=>'<li>'+esc(d.code)+' — '+esc(d.title)+' <span class="text-amber-700">· '+(d.legacyTemplateCode?'formulário-base disponível':'catalogado')+'</span></li>').join('')+'</ul></details>').join('')+'</section><div class="text-xs text-slate-500 mb-4">Catálogo: '+catalogItems.length+' tipos. Os itens assinalados como catalogados ainda não têm todos os formulários e fluxos próprios ligados.</div><label class="block text-sm font-bold mb-2" for="it-template">Modelo com formulário disponível</label><select id="it-template" class="w-full border rounded-xl p-3 mb-4">'+templates.map((t,i)=>'<option value="'+i+'">'+esc(t.code)+' — '+esc(t.title)+'</option>').join('')+'</select><div id="it-document-fields" class="grid md:grid-cols-2 gap-4"></div><div class="flex flex-wrap gap-2 mt-5"><button id="it-document-preview" class="bg-orange text-white rounded-xl px-4 py-3 font-bold">Guardar rascunho e pré-visualizar</button><button id="it-document-issue" class="bg-slate-900 text-white rounded-xl px-4 py-3 font-bold" disabled>Emitir com QR Code</button><button id="it-document-print" class="border rounded-xl px-4 py-3" disabled>Exportar PDF</button><button id="it-document-send" class="border rounded-xl px-4 py-3 opacity-50" disabled>Enviar (canal por configurar)</button></div><div id="it-document-errors" class="text-sm text-red-700 mt-3"></div><div id="it-document-state" class="text-sm text-slate-500 mt-2">Ainda não foi criado qualquer documento.</div><section id="it-document-preview-area" class="mt-6"></section><p class="text-xs text-amber-700 mt-4">A emissão reserva número e QR no servidor antes de gerar o PDF final. O PDF é arquivado e emitido numa operação transaccional. O envio electrónico ainda depende da configuração e homologação de um canal institucional.</p></div>';
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
  function drawFields(){
    const t=templates[Number(select.value)];
    fields.innerHTML=t.fields.map(f=>'<label class="block text-sm font-semibold">'+esc(f.label)+(f.required?' *':'')+(f.type==='textarea'?'<textarea data-field="'+esc(f.key)+'" class="block w-full border rounded-xl p-3 mt-1" rows="3"></textarea>':f.type==='select'?'<select data-field="'+esc(f.key)+'" class="block w-full border rounded-xl p-3 mt-1"><option value="">Seleccionar…</option>'+f.options.map(o=>'<option value="'+esc(o)+'">'+esc(o)+'</option>').join('')+'</select>':'<input data-field="'+esc(f.key)+'" type="'+(f.type==='number'?'number':f.type==='date'?'date':'text')+'" '+(f.type==='number'?'min="0" step="any"':'')+' class="block w-full border rounded-xl p-3 mt-1">')+'</label>').join('');
    errors.textContent='';preview.innerHTML='';latestHtml='';latestDraft=null;latestValues=null;latestTemplate=null;root.querySelector('#it-document-preview').disabled=false;issue.disabled=true;print.disabled=true;send.disabled=true;
    state.textContent='Preencha os campos obrigatórios para guardar um rascunho.';
  }
  select.addEventListener('change',drawFields);
  drawFields();
  root.querySelector('#documents-back').addEventListener('click',()=>renderHome().catch(e=>notify(e.message)));
  root.querySelector('#it-document-preview').addEventListener('click',async()=>{
    const t=templates[Number(select.value)],values={};
    fields.querySelectorAll('[data-field]').forEach(el=>values[el.dataset.field]=el.value);
    const auth=await supabase?.auth?.getUser?.();const actorId=auth?.data?.user?.id||'';
    const created=engine.createDocumentDraft({templateCode:t.code,values,actorId});
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
return Object.freeze({renderHome,loadAudit});}return Object.freeze({normalizeStatus,aggregateAudit,validateDocumentModel,summarizeProcurement,summarizeStockMovements,createProcurementService,create});});