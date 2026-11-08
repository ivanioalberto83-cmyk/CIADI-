-- PROPOSTA APENAS — não executar em produção sem revisão e homologação.
-- Helpdesk institucional da estação Suporte Informático CIADI.
begin;

do $preflight$
begin
  if to_regprocedure('ciadi_ti.has_support_access()') is null then
    raise exception 'Pré-requisito em falta: definir e homologar ciadi_ti.has_support_access() antes de aplicar esta proposta.';
  end if;
end;
$preflight$;

create sequence if not exists ciadi_ti.helpdesk_ticket_number_seq;

create table if not exists ciadi_ti.helpdesk_tickets (
  id bigint generated always as identity primary key,
  ticket_number text unique,
  title text not null check (char_length(btrim(title)) between 5 and 160),
  description text not null check (char_length(btrim(description)) between 10 and 5000),
  category text not null check (category in ('hardware','software','network','access','security','backup','procurement','other')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  status text not null default 'open' check (status in ('open','in_progress','waiting','resolved','closed')),
  location text not null check (char_length(btrim(location)) between 1 and 160),
  affected_service text check (affected_service is null or char_length(affected_service)<=160),
  created_by uuid not null references auth.users(id),
  assigned_to uuid references auth.users(id),
  sla_due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ciadi_ti.helpdesk_ticket_events (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references ciadi_ti.helpdesk_tickets(id) on delete restrict,
  event_type text not null check (char_length(btrim(event_type)) between 2 and 60),
  message text not null check (char_length(btrim(message)) between 1 and 4000),
  from_status text,
  to_status text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists helpdesk_tickets_created_by_idx on ciadi_ti.helpdesk_tickets(created_by,created_at desc);
create index if not exists helpdesk_tickets_status_priority_idx on ciadi_ti.helpdesk_tickets(status,priority,created_at desc);
create index if not exists helpdesk_events_ticket_created_idx on ciadi_ti.helpdesk_ticket_events(ticket_id,created_at);

create or replace function ciadi_ti.assign_helpdesk_ticket_number()
returns trigger language plpgsql security definer
set search_path = pg_catalog, ciadi_ti
as $$
begin
  if new.ticket_number is null then
    new.ticket_number := 'HD-' || to_char(clock_timestamp(),'YYYY') || '-' ||
      lpad(nextval('ciadi_ti.helpdesk_ticket_number_seq')::text,6,'0');
  end if;
  return new;
end;
$$;

create or replace function ciadi_ti.record_helpdesk_ticket_updated()
returns trigger language plpgsql security definer
set search_path = pg_catalog, ciadi_ti
as $
begin
  if new.status is distinct from old.status then
    insert into ciadi_ti.helpdesk_ticket_events(ticket_id,event_type,message,from_status,to_status,created_by)
    values(new.id,'status_changed','Estado alterado de ' || old.status || ' para ' || new.status || '.',old.status,new.status,coalesce(auth.uid(),new.created_by));
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into ciadi_ti.helpdesk_ticket_events(ticket_id,event_type,message,created_by)
    values(new.id,'technician_assigned',
      case when new.assigned_to is null then 'Atribuição de técnico removida.' else 'Técnico responsável actualizado.' end,
      coalesce(auth.uid(),new.created_by));
  end if;
  return new;
end;
$;

create or replace function ciadi_ti.record_helpdesk_ticket_created()
returns trigger language plpgsql security definer
set search_path = pg_catalog, ciadi_ti
as $$
begin
  insert into ciadi_ti.helpdesk_ticket_events(ticket_id,event_type,message,to_status,created_by)
  values(new.id,'ticket_created','Chamado registado.',new.status,new.created_by);
  return new;
end;
$$;

drop trigger if exists helpdesk_ticket_number_before_insert on ciadi_ti.helpdesk_tickets;
create trigger helpdesk_ticket_number_before_insert
before insert on ciadi_ti.helpdesk_tickets
for each row execute function ciadi_ti.assign_helpdesk_ticket_number();

drop trigger if exists helpdesk_ticket_updated_after_update on ciadi_ti.helpdesk_tickets;
create trigger helpdesk_ticket_updated_after_update
after update of status, assigned_to on ciadi_ti.helpdesk_tickets
for each row execute function ciadi_ti.record_helpdesk_ticket_updated();

drop trigger if exists helpdesk_ticket_created_after_insert on ciadi_ti.helpdesk_tickets;
create trigger helpdesk_ticket_created_after_insert
after insert on ciadi_ti.helpdesk_tickets
for each row execute function ciadi_ti.record_helpdesk_ticket_created();

alter table ciadi_ti.helpdesk_tickets enable row level security;
alter table ciadi_ti.helpdesk_ticket_events enable row level security;

drop policy if exists helpdesk_ticket_select on ciadi_ti.helpdesk_tickets;
create policy helpdesk_ticket_select on ciadi_ti.helpdesk_tickets
for select to authenticated
using (created_by = (select auth.uid()) or ciadi_ti.has_support_access());

drop policy if exists helpdesk_ticket_insert on ciadi_ti.helpdesk_tickets;
create policy helpdesk_ticket_insert on ciadi_ti.helpdesk_tickets
for insert to authenticated
with check (created_by = (select auth.uid()) and status = 'open' and assigned_to is null);

drop policy if exists helpdesk_ticket_update_support on ciadi_ti.helpdesk_tickets;
create policy helpdesk_ticket_update_support on ciadi_ti.helpdesk_tickets
for update to authenticated
using (ciadi_ti.has_support_access())
with check (ciadi_ti.has_support_access());

drop policy if exists helpdesk_event_select on ciadi_ti.helpdesk_ticket_events;
create policy helpdesk_event_select on ciadi_ti.helpdesk_ticket_events
for select to authenticated
using (
  exists (
    select 1 from ciadi_ti.helpdesk_tickets t
    where t.id = ticket_id
      and (t.created_by = (select auth.uid()) or ciadi_ti.has_support_access())
  )
);

drop policy if exists helpdesk_event_insert on ciadi_ti.helpdesk_ticket_events;
create policy helpdesk_event_insert on ciadi_ti.helpdesk_ticket_events
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and event_type = 'intervention'
  and exists (
    select 1 from ciadi_ti.helpdesk_tickets t
    where t.id = ticket_id
      and (t.created_by = (select auth.uid()) or ciadi_ti.has_support_access())
  )
);

comment on table ciadi_ti.helpdesk_tickets is 'Chamados do Helpdesk institucional CIADI; proposta para homologação.';
comment on table ciadi_ti.helpdesk_ticket_events is 'Histórico imutável de eventos e intervenções do Helpdesk CIADI.';
comment on function ciadi_ti.assign_helpdesk_ticket_number() is 'Atribui referência sequencial no servidor; não reutilizar números.';
comment on function ciadi_ti.record_helpdesk_ticket_created() is 'Regista automaticamente a abertura do chamado no histórico.';
comment on function ciadi_ti.record_helpdesk_ticket_updated() is 'Regista alterações de estado e atribuição no histórico; eventos sem UPDATE/DELETE para utilizadores.';

commit;
