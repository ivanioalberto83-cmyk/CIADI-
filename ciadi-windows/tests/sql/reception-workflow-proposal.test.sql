-- Homologação funcional em PostgreSQL isolado. Executar após bootstrap-reception.sql e proposta.
\set ON_ERROR_STOP on

insert into public.especialidades(id,nome,ativo,ordem) values
 ('21000000-0000-4000-8000-000000000001','Psicologia',true,1),
 ('21000000-0000-4000-8000-000000000002','Terapia Ocupacional',true,2),
 ('21000000-0000-4000-8000-000000000003','Especialidade Inactiva',false,3);

insert into public.pacientes(id,nome_completo,codigo_paciente,nome_responsavel) values
 ('22000000-0000-4000-8000-000000000001','Utente de Homologação','CIADI-TEST-001','Responsável de Homologação');

insert into public.perfis(id,tipo,ativo) values
 ('24000000-0000-4000-8000-000000000001','operador',true),
 ('24000000-0000-4000-8000-000000000002','operador',true),
 ('24000000-0000-4000-8000-000000000003','suporte_informatica',true),
 ('24000000-0000-4000-8000-000000000004','operador',true);
insert into ciadi_ti.reception_user_polos(user_id,polo_code,active) values
 ('24000000-0000-4000-8000-000000000001','talatona',true),
 ('24000000-0000-4000-8000-000000000001','jardim_de_rosas',true),
 ('24000000-0000-4000-8000-000000000002','talatona',true),
 ('24000000-0000-4000-8000-000000000004','talatona',true);

insert into public.agendamentos(id,paciente_id,data_hora,duracao_minutos,tipo,estado,modalidade,polo_code) values
 ('23000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001',now()+interval '1 hour',60,'consulta','confirmada','presencial','jardim_de_rosas');

insert into ciadi_ti.warehouses(id,code,name,polo,active) values
 ('32000000-0000-4000-8000-000000000001','WH-TAL','Armazém Talatona','talatona',true),
 ('32000000-0000-4000-8000-000000000002','WH-JR','Armazém Jardim de Rosas','jardim_de_rosas',true);
insert into ciadi_ti.items(id,sku,name,active) values
 ('33000000-0000-4000-8000-000000000001','ITEM-TAL','Material de homologação Talatona',true),
 ('33000000-0000-4000-8000-000000000002','ITEM-JR','Material de homologação Jardim de Rosas',true);
insert into ciadi_ti.stock_requisitions(
 id,polo_code,warehouse_id,cost_center_id,purpose,priority,status,requested_by,idempotency_key
) values
 ('34000000-0000-4000-8000-000000000001','talatona','32000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','Reposição de consumíveis de recepção','normal','submitted','24000000-0000-4000-8000-000000000001','TEST-REQ-TAL'),
 ('34000000-0000-4000-8000-000000000002','jardim_de_rosas','32000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000002','Reposição de consumíveis de recepção','normal','submitted','24000000-0000-4000-8000-000000000001','TEST-REQ-JR');
insert into ciadi_ti.stock_requisition_lines(id,requisition_id,item_id,quantity_requested,quantity_approved,quantity_issued,unit_of_measure) values
 ('35000000-0000-4000-8000-000000000001','34000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001',2,0,0,'unidade'),
 ('35000000-0000-4000-8000-000000000002','34000000-0000-4000-8000-000000000002','33000000-0000-4000-8000-000000000002',2,0,0,'unidade');

set role authenticated;

select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000001',false);

do $$
declare
  v_actor uuid := '24000000-0000-4000-8000-000000000001';
  v_walk jsonb;
  v_walk_two jsonb;
  v_appointment jsonb;
  v_visitor jsonb;
  v_transition jsonb;
  v_referral jsonb;
  v_dashboard jsonb;
  v_search jsonb;
  v_visit_id uuid;
  v_visitor_id uuid;
  v_count integer;
begin
  if auth.uid() is distinct from v_actor then
    raise exception 'Fixture de sessão não configurada.';
  end if;

  v_walk := ciadi_reception.reception_register_arrival(
    'walk_in',null,null,'Responsável Teste','Entrega de documentação','talatona',v_actor
  );
  v_visit_id := (v_walk->>'id')::uuid;
  if (v_walk->>'ticket_number')::integer <> 1 then
    raise exception 'A primeira senha do polo deveria ser 1.';
  end if;

  v_walk_two := ciadi_reception.reception_register_arrival(
    'walk_in',null,null,'Outro Responsável','Pedido de informação','talatona',v_actor
  );
  if (v_walk_two->>'ticket_number')::integer <> 2 then
    raise exception 'A senha sequencial do polo deveria ser 2.';
  end if;

  begin
    perform ciadi_reception.reception_register_arrival(
      'walk_in',null,null,'Actor inválido','Teste de segurança','talatona',
      '24000000-0000-4000-8000-000000000099'
    );
    raise exception 'Actor diferente da sessão deveria ser recusado.';
  exception when sqlstate '42501' then null;
  end;

  v_transition := ciadi_reception.reception_transition_visit(v_visit_id,'waiting','in_service',v_actor);
  if v_transition->>'status' <> 'in_service' then
    raise exception 'A transição para atendimento não foi persistida.';
  end if;

  begin
    perform ciadi_reception.reception_transition_visit(v_visit_id,'in_service','no_show',v_actor);
    raise exception 'A transição inválida deveria ser recusada.';
  exception when sqlstate '22023' then null;
  end;

  v_referral := ciadi_reception.reception_route_visit(
    (v_walk_two->>'id')::uuid,'21000000-0000-4000-8000-000000000001',v_actor
  );
  if v_referral->>'destination_service' <> 'Psicologia' then
    raise exception 'O encaminhamento não devolveu o destino correcto.';
  end if;
  v_referral := ciadi_reception.reception_confirm_referral((v_walk_two->>'id')::uuid,v_actor);
  if v_referral->>'referral_status' <> 'accepted' then
    raise exception 'O encaminhamento não ficou aceite.';
  end if;

  v_visitor := ciadi_reception.reception_register_visitor(
    'Visitante Teste','Reunião administrativa','Administração','talatona',v_actor
  );
  v_visitor_id := (v_visitor->>'id')::uuid;
  if v_visitor->>'status' <> 'inside' then
    raise exception 'O visitante deveria ficar registado como presente.';
  end if;
  v_visitor := ciadi_reception.reception_close_visitor(v_visitor_id,v_actor);
  if v_visitor->>'status' <> 'exited' then
    raise exception 'A saída do visitante não foi registada.';
  end if;

  v_search := ciadi_reception.reception_search_appointments(
    'CIADI-TEST-001',current_date,current_date+1,'jardim_de_rosas'
  );
  if jsonb_array_length(v_search) <> 1 then
    raise exception 'A pesquisa não encontrou a marcação de teste.';
  end if;

  v_appointment := ciadi_reception.reception_register_arrival(
    'appointment','23000000-0000-4000-8000-000000000001',
    '22000000-0000-4000-8000-000000000001',
    'Responsável de Homologação','Consulta agendada','jardim_de_rosas',v_actor
  );
  if (v_appointment->>'ticket_number')::integer <> 1 then
    raise exception 'A sequência de senhas deve ser independente por polo.';
  end if;
  if not exists (
    select 1 from public.agendamentos
    where id='23000000-0000-4000-8000-000000000001'
      and estado='check-in' and checkin_em is not null
      and atualizado_por=v_actor
  ) then
    raise exception 'O check-in não actualizou a marcação existente.';
  end if;

  v_dashboard := ciadi_reception.reception_get_dashboard('talatona');
  if (v_dashboard#>>'{summary,total}')::integer <> 2 then
    raise exception 'O dashboard não reflecte os dois atendimentos de Talatona.';
  end if;
  if jsonb_array_length(v_dashboard->'visitors') <> 0 then
    raise exception 'O visitante que já saiu não deve constar como presente.';
  end if;

  select count(*) into v_count from ciadi_reception.front_desk_visit_events
  where visit_id in (v_visit_id,(v_walk_two->>'id')::uuid);
  if v_count < 4 then
    raise exception 'O histórico de eventos não foi integralmente registado.';
  end if;
end;
$$;

-- Conta de um único polo: não pode pesquisar nem ler dados do outro polo.
select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000004',false);
do $function$
declare v_count integer;
begin
  if auth.uid() <> '24000000-0000-4000-8000-000000000004'::uuid then
    raise exception 'A sessão do operador de Talatona não foi aplicada correctamente: %',auth.uid();
  end if;
  if not ciadi_ti.has_reception_operation_access('talatona') then
    raise exception 'O operador de Talatona não passou a autorização server-side para o seu polo.';
  end if;
  if ciadi_ti.has_reception_operation_access('jardim_de_rosas') then
    raise exception 'O operador de Talatona recebeu indevidamente acesso a Jardim de Rosas.';
  end if;
  select count(*) into v_count from ciadi_reception.front_desk_visits;
  if v_count <> 2 then raise exception 'O operador de Talatona deve ver apenas dois atendimentos; resultado: %.',v_count; end if;
  select count(*) into v_count from ciadi_ti.stock_requisitions;
  if v_count <> 1 then raise exception 'O operador de Talatona deve ver apenas uma requisição de stock; resultado: %.',v_count; end if;
  select count(*) into v_count from ciadi_ti.stock_requisition_lines;
  if v_count <> 1 then raise exception 'O operador de Talatona deve ver apenas uma linha de stock; resultado: %.',v_count; end if;
  begin
    perform ciadi_reception.reception_search_appointments('CIADI-TEST-001',current_date,current_date+1,'jardim_de_rosas');
    raise exception 'O operador de Talatona não pode pesquisar marcações de Jardim de Rosas.';
  exception when sqlstate '42501' then null;
  end;
end;
$function$;

-- Suporte Informático mantém acesso transversal aos dois polos, sem acesso clínico geral.
select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000003',false);
do $function$
declare v_count integer;
begin
  select count(*) into v_count from ciadi_reception.front_desk_visits;
  if v_count <> 3 then raise exception 'O Suporte deve ver os três atendimentos dos dois polos.'; end if;
  select count(*) into v_count from ciadi_ti.stock_requisitions;
  if v_count <> 2 then raise exception 'O Suporte deve ver as duas requisições de stock dos dois polos.'; end if;
  select count(*) into v_count from ciadi_ti.stock_requisition_lines;
  if v_count <> 2 then raise exception 'O Suporte deve ver as duas linhas de stock dos dois polos.'; end if;
end;
$function$;

-- A homologação confirma grants e policies apenas para a operação da Recepção.
do $function$
begin
  if not has_schema_privilege('authenticated','ciadi_reception','USAGE') then
    raise exception 'O schema de Recepção deve estar acessível a utilizadores autenticados.';
  end if;
  if has_schema_privilege('anon','ciadi_reception','USAGE') then
    raise exception 'O schema de Recepção não pode ficar acessível a utilizadores anónimos.';
  end if;
  if not exists (
    select 1 from pg_roles r, unnest(r.rolconfig) cfg
    where r.rolname='authenticator' and cfg like 'pgrst.db_schemas=%ciadi_reception%'
  ) then
    raise exception 'O schema de Recepção não foi adicionado à lista exposta do PostgREST.';
  end if;
  if not has_function_privilege('authenticated',
    'ciadi_reception.reception_register_arrival(text,uuid,uuid,text,text,text,uuid)','EXECUTE') then
    raise exception 'A função de chegada deve ser executável por utilizadores autenticados e validar o polo.';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='ciadi_reception'
        and c.relname in ('front_desk_visits','front_desk_visit_events','visitor_entries')
        and c.relrowsecurity) <> 3 then
    raise exception 'RLS deve estar activa nas três tabelas operacionais.';
  end if;
  if (select count(*) from pg_policies
      where schemaname='ciadi_reception'
        and tablename in ('front_desk_visits','front_desk_visit_events','visitor_entries')) <> 7 then
    raise exception 'As sete policies de acesso por polo não foram criadas.';
  end if;
  if not has_table_privilege('authenticated','ciadi_ti.stock_requisitions','SELECT')
     or not has_table_privilege('authenticated','ciadi_ti.stock_requisition_lines','SELECT') then
    raise exception 'A Recepção precisa de leitura autenticada das requisições e linhas de stock.';
  end if;
  if has_table_privilege('authenticated','ciadi_ti.stock_requisitions','INSERT')
     or has_table_privilege('authenticated','ciadi_ti.stock_requisitions','UPDATE') then
    raise exception 'As escritas de stock devem continuar limitadas às RPCs transaccionais.';
  end if;
  if (select count(*) from pg_policies
      where schemaname='ciadi_ti'
        and tablename in ('stock_requisitions','stock_requisition_lines')
        and policyname in ('ciadi_stock_requisitions_select_by_polo','ciadi_stock_requisition_lines_select_by_polo')) <> 2 then
    raise exception 'As duas policies de leitura de stock por polo não foram criadas.';
  end if;
end;
$function$;

select 'CIADI reception SQL homologation: PASS' as result;
