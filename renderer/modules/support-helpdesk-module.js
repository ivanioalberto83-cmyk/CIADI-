(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CIADI_SUPPORT_HELPDESK=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const STATUSES=Object.freeze(['open','in_progress','waiting','resolved','closed']);
const PRIORITIES=Object.freeze(['low','normal','high','critical']);
const CATEGORIES=Object.freeze(['hardware','software','network','access','security','backup','procurement','other']);
const LABELS=Object.freeze({open:'Aberto',in_progress:'Em tratamento',waiting:'A aguardar',resolved:'Resolvido',closed:'Encerrado',low:'Baixa',normal:'Normal',high:'Alta',critical:'Crítica'});
function clean(v,max=2000){return String(v??'').trim().slice(0,max);}
function validateTicket(input={}){
 const errors=[];
 if(clean(input.title,160).length<5)errors.push('O título deve ter pelo menos 5 caracteres.');
 if(clean(input.description,5000).length<10)errors.push('A descrição deve ter pelo menos 10 caracteres.');
 if(!CATEGORIES.includes(input.category))errors.push('Seleccione uma categoria válida.');
 if(!PRIORITIES.includes(input.priority))errors.push('Seleccione uma prioridade válida.');
 if(!clean(input.location,160))errors.push('Indique o polo ou localização afectada.');
 return Object.freeze({valid:errors.length===0,errors:Object.freeze(errors),value:Object.freeze({title:clean(input.title,160),description:clean(input.description,5000),category:input.category,priority:input.priority,location:clean(input.location,160),affectedService:clean(input.affectedService,160)})});
}
function summarizeTickets(rows=[]){
 const result={total:0,byStatus:{},byPriority:{},byCategory:{},overdue:0,open:0,resolved:0};
 for(const row of Array.isArray(rows)?rows:[]){
  result.total++;const status=STATUSES.includes(row.status)?row.status:'open';const priority=PRIORITIES.includes(row.priority)?row.priority:'normal';const category=CATEGORIES.includes(row.category)?row.category:'other';
  result.byStatus[status]=(result.byStatus[status]||0)+1;result.byPriority[priority]=(result.byPriority[priority]||0)+1;result.byCategory[category]=(result.byCategory[category]||0)+1;
  if(['open','in_progress','waiting'].includes(status))result.open++;
  if(['resolved','closed'].includes(status))result.resolved++;
  if(row.sla_due_at&&new Date(row.sla_due_at).getTime()<Date.now()&&!['resolved','closed'].includes(status))result.overdue++;
 }
 return Object.freeze(result);
}
function createRepository({supabase}={}){
 const db=supabase?.schema?.('ciadi_ti');
 if(!db)throw new Error('O schema ciadi_ti não está disponível nesta sessão.');
 return Object.freeze({
  async list({limit=100}={}){const {data,error}=await db.from('helpdesk_tickets').select('id,ticket_number,title,description,category,priority,status,location,affected_service,created_by,assigned_to,sla_due_at,created_at,updated_at').order('created_at',{ascending:false}).limit(Math.min(200,Math.max(1,limit)));if(error)throw error;return data||[];},
  async create(input,actorId){const valid=validateTicket(input);if(!valid.valid)throw new Error(valid.errors.join(' '));if(!clean(actorId,128))throw new Error('Sessão autenticada necessária.');const {data,error}=await db.from('helpdesk_tickets').insert({...valid.value,created_by:actorId,status:'open'}).select('id,ticket_number,title,description,category,priority,status,location,affected_service,created_by,created_at').single();if(error)throw error;return data;},
  async events(ticketId){const {data,error}=await db.from('helpdesk_ticket_events').select('id,ticket_id,event_type,message,from_status,to_status,created_by,created_at').eq('ticket_id',ticketId).order('created_at',{ascending:true}).limit(200);if(error)throw error;return data||[];}
 });
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function create({root,supabase,notify=()=>{},onBack=()=>{}}={}){
 if(!root)throw new Error('Contentor do Helpdesk obrigatório.');
 let tickets=[];
 async function render(){
  root.innerHTML='<section class="card p-5">A consultar o Helpdesk institucional…</section>';
  let repo;
  try{repo=createRepository({supabase});tickets=await repo.list();}
  catch(e){root.innerHTML='<section class="card p-5"><h2 class="text-xl font-black">Helpdesk institucional</h2><p class="text-amber-700 mt-2">O Helpdesk ainda não está ligado ao arquivo homologado: '+esc(e.message)+'</p><p class="text-sm text-slate-500 mt-2">Nenhum chamado foi criado. A estrutura própria e as políticas de acesso precisam de homologação antes da activação.</p><button id="hd-back" class="border rounded-xl px-3 py-2 mt-4">Voltar ao Centro de Operações</button></section>';root.querySelector('#hd-back').onclick=()=>onBack();return;}
  const stats=summarizeTickets(tickets);
  root.innerHTML='<div class="flex flex-wrap items-start justify-between gap-3 mb-5"><div><span class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Assistência técnica</span><h2 class="text-2xl font-black mt-1">Helpdesk institucional</h2><p class="text-sm text-slate-500">Chamados, incidentes, assistência e histórico de intervenções.</p></div><button id="hd-new" class="bg-orange text-white rounded-xl px-4 py-2 font-bold">Novo chamado</button></div><div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5"><article class="card p-4"><small>Total de chamados</small><div class="text-2xl font-black">'+stats.total+'</div></article><article class="card p-4"><small>Em aberto</small><div class="text-2xl font-black">'+stats.open+'</div></article><article class="card p-4"><small>Resolvidos / encerrados</small><div class="text-2xl font-black">'+stats.resolved+'</div></article><article class="card p-4"><small>Fora do prazo SLA</small><div class="text-2xl font-black">'+stats.overdue+'</div></article></div><section class="card p-5"><div class="flex justify-between gap-3 items-center mb-3"><h3 class="font-black">Fila de atendimento</h3><button id="hd-refresh" class="border rounded-lg px-3 py-1 text-sm">Actualizar</button></div>'+(tickets.length?'<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left border-b"><th class="py-2">Referência</th><th>Título</th><th>Categoria</th><th>Prioridade</th><th>Estado</th><th>Data</th></tr></thead><tbody>'+tickets.map(t=>'<tr data-ticket="'+esc(t.id)+'" class="border-b cursor-pointer hover:bg-orange-50"><td class="py-3 font-bold">'+esc(t.ticket_number||t.id)+'</td><td>'+esc(t.title)+'</td><td>'+esc(t.category)+'</td><td>'+esc(LABELS[t.priority]||t.priority)+'</td><td>'+esc(LABELS[t.status]||t.status)+'</td><td>'+esc(t.created_at?new Date(t.created_at).toLocaleString('pt-PT'):'')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="text-sm text-slate-500 py-6">Ainda não existem chamados registados.</p>')+'</section>';
  root.querySelector('#hd-refresh').onclick=()=>render().catch(e=>notify(e.message));root.querySelectorAll('[data-ticket]').forEach(row=>row.addEventListener('click',()=>renderDetail(repo,row.dataset.ticket).catch(e=>notify(e.message))));
  root.querySelector('#hd-new').onclick=()=>renderNew(repo);
 }
 async function renderDetail(repo,ticketId){const ticket=tickets.find(x=>String(x.id)===String(ticketId));if(!ticket)return render();let events=[];let eventError=null;try{events=await repo.events(ticketId);}catch(e){eventError=e;}root.innerHTML='<section class="card p-5"><div class="flex justify-between gap-3"><div><small class="text-orange font-bold">'+esc(ticket.ticket_number||ticket.id)+'</small><h2 class="text-xl font-black">'+esc(ticket.title)+'</h2></div><button id="hd-detail-back" class="border rounded-lg px-3 py-1">Voltar</button></div><p class="text-sm text-slate-600 mt-3">'+esc(ticket.description)+'</p><div class="grid sm:grid-cols-3 gap-3 mt-4 text-sm"><div><b>Estado</b><div>'+esc(LABELS[ticket.status]||ticket.status)+'</div></div><div><b>Prioridade</b><div>'+esc(LABELS[ticket.priority]||ticket.priority)+'</div></div><div><b>Localização</b><div>'+esc(ticket.location)+'</div></div></div><h3 class="font-black mt-6 mb-2">Histórico de intervenções</h3>'+(eventError?'<p class="text-amber-700">Histórico indisponível: '+esc(eventError.message)+'</p>':events.length?'<ol class="space-y-3">'+events.map(ev=>'<li class="border-l-2 border-orange pl-3"><b>'+esc(ev.event_type)+'</b><p class="text-sm">'+esc(ev.message)+'</p><small class="text-slate-500">'+esc(ev.created_at?new Date(ev.created_at).toLocaleString('pt-PT'):'')+'</small></li>').join('')+'</ol>':'<p class="text-sm text-slate-500">Ainda não existem intervenções registadas.</p>')+'</section>';root.querySelector('#hd-detail-back').onclick=()=>render();}\n async function renderNew(repo){
  root.innerHTML='<section class="card p-5"><div class="flex justify-between items-center"><h2 class="text-xl font-black">Abrir chamado</h2><button id="hd-cancel" class="border rounded-lg px-3 py-1">Cancelar</button></div><form id="hd-form" class="grid md:grid-cols-2 gap-3 mt-4"><label class="text-sm font-semibold">Título *<input name="title" required minlength="5" maxlength="160" class="block w-full border rounded-xl p-3 mt-1"></label><label class="text-sm font-semibold">Polo / localização *<input name="location" required maxlength="160" class="block w-full border rounded-xl p-3 mt-1" placeholder="Talatona / Jardim de Rosas"></label><label class="text-sm font-semibold">Categoria *<select name="category" class="block w-full border rounded-xl p-3 mt-1">'+CATEGORIES.map(x=>'<option value="'+x+'">'+esc(x)+'</option>').join('')+'</select></label><label class="text-sm font-semibold">Prioridade *<select name="priority" class="block w-full border rounded-xl p-3 mt-1">'+PRIORITIES.map(x=>'<option value="'+x+'">'+esc(LABELS[x])+'</option>').join('')+'</select></label><label class="text-sm font-semibold md:col-span-2">Serviço afectado<input name="affectedService" maxlength="160" class="block w-full border rounded-xl p-3 mt-1"></label><label class="text-sm font-semibold md:col-span-2">Descrição detalhada *<textarea name="description" required minlength="10" maxlength="5000" rows="5" class="block w-full border rounded-xl p-3 mt-1"></textarea></label><div class="md:col-span-2 flex gap-2"><button class="bg-orange text-white rounded-xl px-4 py-2 font-bold" type="submit">Registar chamado</button><span id="hd-state" class="text-sm text-slate-500 self-center"></span></div></form></section>';
  root.querySelector('#hd-cancel').onclick=()=>render();
  root.querySelector('#hd-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;const state=root.querySelector('#hd-state');const data=Object.fromEntries(new FormData(form).entries());const auth=await supabase.auth?.getUser?.();const actor=auth?.data?.user?.id;if(!actor){state.textContent='Sessão autenticada necessária.';return;}const checked=validateTicket(data);if(!checked.valid){state.textContent=checked.errors.join(' ');return;}const button=form.querySelector('button[type="submit"]');button.disabled=true;state.textContent='A registar…';try{const saved=await repo.create(data,actor);notify('Chamado registado: '+(saved.ticket_number||saved.id));await render();}catch(err){button.disabled=false;state.textContent='Não foi possível registar: '+(err.message||'erro desconhecido');}};
 }
 return Object.freeze({render});
}
return Object.freeze({STATUSES,PRIORITIES,CATEGORIES,LABELS,validateTicket,summarizeTickets,createRepository,create});
});
