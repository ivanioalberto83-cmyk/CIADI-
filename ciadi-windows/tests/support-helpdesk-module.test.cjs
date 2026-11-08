const test=require('node:test');const assert=require('node:assert/strict');const hd=require('../../renderer/modules/support-helpdesk-module.js');const identity=require('../../renderer/core/institutional-identity-service.js');
test('valida os campos obrigatórios e limites do chamado',()=>{assert.equal(hd.validateTicket({}).valid,false);const r=hd.validateTicket({title:'Falha de rede',description:'Sem acesso à rede local',category:'network',priority:'high',location:'Talatona'});assert.equal(r.valid,true);assert.equal(r.value.priority,'high');});
test('rejeita categorias e prioridades fora do catálogo',()=>{const r=hd.validateTicket({title:'Falha grave',description:'Descrição suficiente',category:'root',priority:'urgent',location:'Talatona'});assert.equal(r.valid,false);assert.ok(r.errors.some(x=>x.includes('categoria')));assert.ok(r.errors.some(x=>x.includes('prioridade')));});
test('resume fila por estado, prioridade, categoria e SLA',()=>{const r=hd.summarizeTickets([{status:'open',priority:'critical',category:'network',sla_due_at:'2000-01-01T00:00:00Z'},{status:'resolved',priority:'normal',category:'hardware'}]);assert.equal(r.total,2);assert.equal(r.open,1);assert.equal(r.resolved,1);assert.equal(r.overdue,1);assert.equal(r.byPriority.critical,1);});
test('identidade institucional central contém marca, paleta e contacto CIADI',()=>{const b=identity.getBrand();assert.equal(b.acronym,'CIADI');assert.equal(b.palette.orange,'#f58200');assert.equal(b.email,'geral@ciadi.ao');assert.match(identity.renderDocumentHeader({title:'Relatório'}),/CENTRO INTEGRADO/);});
test('escapa valores não confiáveis no cabeçalho documental',()=>{assert.doesNotMatch(identity.renderDocumentHeader({title:'<script>'}),/<script>/);});
test('valida atribuição de técnico e exige identificadores',()=>{assert.equal(hd.validateAssignment({assignedTo:'',actorId:'user-1'}).valid,false);const r=hd.validateAssignment({assignedTo:'tech-1',actorId:'user-1'});assert.equal(r.valid,true);assert.equal(r.value.assignedTo,'tech-1');});
test('valida estados do ciclo de vida do chamado',()=>{assert.equal(hd.validateTicketStatus('in_progress').valid,true);assert.equal(hd.validateTicketStatus('invalid').valid,false);});
test('valida intervenções e exige mensagem e actor autenticado',()=>{assert.equal(hd.validateIntervention({message:'',actorId:'user-1'}).valid,false);assert.equal(hd.validateIntervention({message:'',actorId:''}).valid,false);const r=hd.validateIntervention({message:'Diagnóstico efectuado e equipamento testado.',actorId:'user-1'});assert.equal(r.valid,true);});

test('repositório disponibiliza atribuição, alteração de estado e intervenção',async()=>{
 const calls=[];
 const db={from(table){return{
  update(values){calls.push({operation:'update',table,values});return{eq(column,value){calls[calls.length-1].where={column,value};return{select(){return{single:async()=>({data:values,error:null})}}}}}},
  insert(values){calls.push({operation:'insert',table,values});return{select(){return{single:async()=>({data:values,error:null})}}}}
 };}};
 const repo=hd.createRepository({supabase:{schema:()=>db}});
 await repo.assign(12,'technician-1','actor-1');
 await repo.updateStatus(12,'in_progress','actor-1');
 await repo.addIntervention(12,{message:'Diagnóstico efectuado e equipamento testado.'},'actor-1');
 assert.deepEqual(calls.map(x=>x.operation),['update','update','insert']);
 assert.equal(calls[0].values.assigned_to,'technician-1');
 assert.equal(calls[1].values.status,'in_progress');
 assert.equal(calls[2].values.event_type,'intervention');
 assert.equal(calls[2].values.created_by,'actor-1');
});
