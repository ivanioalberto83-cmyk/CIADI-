-- CIADI Recepção — endurecimento de acesso por utilizador e polo.
-- Aplicar apenas depois de ciadi-reception-workflow-proposal.sql e
-- ciadi-reception-stock-workflows-proposal.sql. Não atribui polos a marcações existentes.
begin;

do $$
begin
  if to_regprocedure('ciadi_ti.has_reception_operation_access(text)') is null then
    raise exception 'Pré-requisito em falta: ciadi_ti.has_reception_operation_access(text).';
  end if;
  if to_regclass('ciadi_ti.reception_user_polos') is null then
    raise exception 'Pré-requisito em falta: ciadi_ti.reception_user_polos.';
  end if;
end;
$$;

-- A tabela de atribuições só revela ao operador as próprias ligações.
alter table ciadi_ti.reception_user_polos enable row level security;
drop policy if exists ciadi_reception_user_polos_self_select on ciadi_ti.reception_user_polos;
create policy ciadi_reception_user_polos_self_select
  on ciadi_ti.reception_user_polos for select to authenticated
  using (user_id = (select auth.uid()));
grant select on ciadi_ti.reception_user_polos to authenticated;

-- A função de autorização usa SECURITY INVOKER e só consulta o perfil e os polos do próprio utilizador.
revoke all on function ciadi_ti.has_reception_operation_access(text) from public, anon;
grant execute on function ciadi_ti.has_reception_operation_access(text) to authenticated;

-- As marcações antigas ficam sem polo até classificação explícita.
alter table public.agendamentos add column if not exists polo_code text;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.agendamentos'::regclass
      and conname='agendamentos_polo_code_check'
  ) then
    alter table public.agendamentos
      add constraint agendamentos_polo_code_check
      check (polo_code is null or polo_code in ('talatona','jardim_de_rosas'));
  end if;
end;
$$;
create index if not exists agendamentos_polo_data_hora_idx
  on public.agendamentos (polo_code,data_hora)
  where polo_code is not null;

-- Pesquisa limitada ao polo autorizado e apenas a campos administrativos mínimos.
drop function if exists ciadi_reception.reception_search_appointments(text,date,date);
create or replace function ciadi_reception.reception_search_appointments(
  p_search_term text,
  p_date_from date,
  p_date_to date,
  p_polo_code text
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, ciadi_reception, ciadi_ti, public, auth
as $$
declare
  v_term text;
  v_result jsonb;
begin
  if auth.uid() is null or not ciadi_ti.has_reception_operation_access(p_polo_code) then
    raise exception 'Sem autorização para pesquisar marcações neste polo.' using errcode = '42501';
  end if;
  v_term := trim(regexp_replace(coalesce(p_search_term, ''), '[%_(),]', ' ', 'g'));
  if length(v_term) < 2
     or p_date_from is null
     or p_date_to is null
     or p_date_from > p_date_to
     or p_date_to > p_date_from + 30 then
    raise exception 'Critérios de pesquisa inválidos; o intervalo máximo é de 31 dias.' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(q.item order by q.data_hora), '[]'::jsonb)
  into v_result
  from (
    select a.data_hora,
      jsonb_build_object(
        'id', a.id,
        'paciente_id', a.paciente_id,
        'patient_name', p.nome_completo,
        'responsible_name', p.nome_responsavel,
        'data_hora', a.data_hora,
        'duracao_minutos', a.duracao_minutos,
        'tipo', a.tipo,
        'estado', a.estado,
        'modalidade', a.modalidade
      ) as item
    from public.agendamentos a
    join public.pacientes p on p.id = a.paciente_id
    where a.polo_code = p_polo_code
      and a.data_hora >= (p_date_from::timestamp at time zone 'Africa/Luanda')
      and a.data_hora < ((p_date_to + 1)::timestamp at time zone 'Africa/Luanda')
      and a.estado in ('agendada', 'confirmada')
      and a.checkin_em is null
      and (
        p.nome_completo ilike '%' || v_term || '%'
        or coalesce(p.codigo_paciente, '') ilike '%' || v_term || '%'
        or coalesce(p.nome_responsavel, '') ilike '%' || v_term || '%'
      )
    order by a.data_hora
    limit 50
  ) q;
  return v_result;
end;
$$;

-- A chegada é uma operação transaccional privilegiada: valida o polo e actor
-- antes de tocar na marcação ou nos contadores da fila.
create or replace function ciadi_reception.reception_register_arrival(
  p_visit_type text,
  p_appointment_id uuid,
  p_patient_id uuid,
  p_display_name text,
  p_purpose text,
  p_polo_code text,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, ciadi_reception, ciadi_ti, public, auth
as $$
declare
  v_visit ciadi_reception.front_desk_visits%rowtype;
  v_service_day date := timezone('Africa/Luanda', now())::date;
  v_ticket_number integer;
begin
  if auth.uid() is null or p_actor_id is distinct from auth.uid()
     or not ciadi_ti.has_reception_operation_access(p_polo_code) then
    raise exception 'Sessão ou polo sem autorização.' using errcode = '42501';
  end if;
  if p_visit_type not in ('appointment', 'walk_in')
     or p_polo_code not in ('talatona', 'jardim_de_rosas')
     or length(trim(coalesce(p_display_name, ''))) not between 2 and 120
     or length(trim(coalesce(p_purpose, ''))) not between 2 and 160 then
    raise exception 'Dados de chegada inválidos.' using errcode = '22023';
  end if;
  if p_visit_type = 'walk_in' and (p_appointment_id is not null or p_patient_id is not null) then
    raise exception 'Uma chegada sem marcação não pode transportar referências de marcação ou utente.' using errcode = '22023';
  end if;
  if p_visit_type = 'appointment' then
    if p_appointment_id is null or p_patient_id is null then
      raise exception 'A chegada com marcação exige referências existentes de marcação e utente.' using errcode = '22023';
    end if;
    perform 1
      from public.agendamentos a
      where a.id = p_appointment_id
        and a.paciente_id = p_patient_id
        and a.polo_code = p_polo_code
        and a.estado in ('agendada', 'confirmada')
        and a.checkin_em is null
      for update;
    if not found then
      raise exception 'Marcação inexistente, não atribuída a este polo, já recebida ou sem estado elegível.' using errcode = '22023';
    end if;
    update public.agendamentos
      set estado = 'check-in',
          checkin_em = now(),
          updated_at = now(),
          atualizado_por = p_actor_id
      where id = p_appointment_id
        and polo_code = p_polo_code;
  end if;

  insert into ciadi_reception.front_desk_queue_counters (polo_code, service_day, last_ticket_number)
  values (p_polo_code, v_service_day, 1)
  on conflict (polo_code, service_day)
  do update set last_ticket_number = ciadi_reception.front_desk_queue_counters.last_ticket_number + 1
  returning last_ticket_number into v_ticket_number;

  insert into ciadi_reception.front_desk_visits (
    service_day, ticket_number, visit_type, appointment_id, patient_id,
    display_name, purpose, polo_code, created_by
  ) values (
    v_service_day, v_ticket_number, p_visit_type, p_appointment_id, p_patient_id,
    trim(p_display_name), trim(p_purpose), p_polo_code, p_actor_id
  ) returning * into v_visit;

  insert into ciadi_reception.front_desk_visit_events (
    visit_id, event_type, from_status, to_status, actor_id
  ) values (v_visit.id, 'arrival_registered', null, 'waiting', p_actor_id);

  return jsonb_build_object(
    'id', v_visit.id, 'ticket_number', v_visit.ticket_number, 'service_day', v_visit.service_day,
    'status', v_visit.status, 'arrived_at', v_visit.arrived_at
  );
end;
$$;

-- RLS por polo. O acesso à tabela de contadores permanece apenas no servidor.
alter table ciadi_reception.front_desk_visits enable row level security;
alter table ciadi_reception.front_desk_visit_events enable row level security;
alter table ciadi_reception.visitor_entries enable row level security;

drop policy if exists ciadi_reception_visits_select on ciadi_reception.front_desk_visits;
create policy ciadi_reception_visits_select
  on ciadi_reception.front_desk_visits for select to authenticated
  using (ciadi_ti.has_reception_operation_access(polo_code));

drop policy if exists ciadi_reception_visits_update on ciadi_reception.front_desk_visits;
create policy ciadi_reception_visits_update
  on ciadi_reception.front_desk_visits for update to authenticated
  using (ciadi_ti.has_reception_operation_access(polo_code))
  with check (ciadi_ti.has_reception_operation_access(polo_code) and updated_by = auth.uid());

drop policy if exists ciadi_reception_events_select on ciadi_reception.front_desk_visit_events;
create policy ciadi_reception_events_select
  on ciadi_reception.front_desk_visit_events for select to authenticated
  using (exists (
    select 1 from ciadi_reception.front_desk_visits v
    where v.id = visit_id and ciadi_ti.has_reception_operation_access(v.polo_code)
  ));

drop policy if exists ciadi_reception_events_insert on ciadi_reception.front_desk_visit_events;
create policy ciadi_reception_events_insert
  on ciadi_reception.front_desk_visit_events for insert to authenticated
  with check (actor_id = auth.uid() and exists (
    select 1 from ciadi_reception.front_desk_visits v
    where v.id = visit_id and ciadi_ti.has_reception_operation_access(v.polo_code)
  ));

drop policy if exists ciadi_reception_visitors_select on ciadi_reception.visitor_entries;
create policy ciadi_reception_visitors_select
  on ciadi_reception.visitor_entries for select to authenticated
  using (ciadi_ti.has_reception_operation_access(polo_code));

drop policy if exists ciadi_reception_visitors_insert on ciadi_reception.visitor_entries;
create policy ciadi_reception_visitors_insert
  on ciadi_reception.visitor_entries for insert to authenticated
  with check (created_by = auth.uid() and ciadi_ti.has_reception_operation_access(polo_code));

drop policy if exists ciadi_reception_visitors_update on ciadi_reception.visitor_entries;
create policy ciadi_reception_visitors_update
  on ciadi_reception.visitor_entries for update to authenticated
  using (ciadi_ti.has_reception_operation_access(polo_code))
  with check (ciadi_ti.has_reception_operation_access(polo_code) and closed_by = auth.uid());

revoke all on schema ciadi_reception from public, anon;
grant usage on schema ciadi_reception to authenticated;
-- Expor o esquema dedicado à API REST autenticada do Supabase.
alter role authenticator set "pgrst.db_schemas" = 'public, graphql_public, ciadi_ti, ciadi_reception';
notify pgrst, 'reload config';
grant usage on schema ciadi_ti to authenticated;
grant execute on function ciadi_ti.has_reception_operation_access(text) to authenticated;

revoke all on all tables in schema ciadi_reception from public, anon, authenticated;
grant select, update on ciadi_reception.front_desk_visits to authenticated;
grant select, insert on ciadi_reception.front_desk_visit_events to authenticated;
grant select, insert, update on ciadi_reception.visitor_entries to authenticated;
revoke all on table ciadi_reception.front_desk_queue_counters from public, anon, authenticated;

revoke execute on all functions in schema ciadi_reception from public, anon, authenticated;
grant execute on function ciadi_reception.reception_search_appointments(text,date,date,text) to authenticated;
grant execute on function ciadi_reception.reception_register_arrival(text,uuid,uuid,text,text,text,uuid) to authenticated;
grant execute on function ciadi_reception.reception_transition_visit(uuid,text,text,uuid) to authenticated;
grant execute on function ciadi_reception.reception_register_visitor(text,text,text,text,uuid) to authenticated;
grant execute on function ciadi_reception.reception_close_visitor(uuid,uuid) to authenticated;
grant execute on function ciadi_reception.reception_get_destinations() to authenticated;
grant execute on function ciadi_reception.reception_route_visit(uuid,uuid,uuid) to authenticated;
grant execute on function ciadi_reception.reception_confirm_referral(uuid,uuid) to authenticated;
grant execute on function ciadi_reception.reception_return_referral(uuid,text,uuid) to authenticated;
grant execute on function ciadi_reception.reception_get_dashboard(text) to authenticated;

commit;
