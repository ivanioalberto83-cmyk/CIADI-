-- Ambiente isolado de CI para homologar a proposta. Não contém credenciais nem dados reais.
create extension if not exists pgcrypto;

do $$
begin
  create role anon nologin;
exception when duplicate_object then null;
end $$;
do $$
begin
  create role authenticated nologin;
exception when duplicate_object then null;
end $$;

create schema if not exists auth;
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table public.perfis (
  id uuid primary key,
  ativo boolean not null default true,
  tipo text not null
);

create schema if not exists ciadi_ti;
grant usage on schema ciadi_ti to authenticated;

create table ciadi_ti.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true
);
create table ciadi_ti.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  polo text,
  active boolean not null default true
);
create table ciadi_ti.items (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  name text not null,
  active boolean not null default true
);
create table ciadi_ti.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity,
  requested_by uuid references public.perfis(id),
  supplier_id uuid references ciadi_ti.suppliers(id),
  status text not null,
  justification text,
  estimated_total numeric(14,2) default 0,
  created_at timestamptz not null default now()
);
create table ciadi_ti.purchase_request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references ciadi_ti.purchase_requests(id),
  item_id uuid references ciadi_ti.items(id),
  description text not null,
  quantity numeric(14,3) not null,
  unit_of_measure text not null default 'unidade',
  estimated_unit_cost numeric(14,2),
  created_at timestamptz not null default now()
);
create table ciadi_ti.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references ciadi_ti.items(id),
  warehouse_id uuid not null references ciadi_ti.warehouses(id),
  movement_type text not null,
  quantity_delta numeric(14,3) not null,
  unit_cost numeric(14,2),
  lot_code text,
  reference text,
  notes text,
  related_movement_id uuid references ciadi_ti.stock_movements(id),
  created_by uuid references public.perfis(id),
  created_at timestamptz not null default now()
);
create table ciadi_ti.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references ciadi_ti.warehouses(id),
  status text not null,
  counted_by uuid references public.perfis(id),
  counted_at timestamptz,
  reconciled_by uuid references public.perfis(id),
  reconciled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table ciadi_ti.inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references ciadi_ti.inventory_counts(id),
  item_id uuid not null references ciadi_ti.items(id),
  system_quantity numeric(14,3) not null,
  counted_quantity numeric(14,3) not null,
  variance numeric(14,3) not null,
  notes text,
  created_at timestamptz not null default now()
);
create table ciadi_ti.audit_events (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null,
  actor_id uuid references public.perfis(id),
  occurred_at timestamptz not null default now()
);

create or replace function ciadi_ti.has_support_access()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.ativo = true
      and p.tipo in ('admin','gestor','suporte_informatica')
  );
$$;

create or replace function ciadi_ti.post_stock_movement(
  p_item_id uuid,
  p_warehouse_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_reference text default null,
  p_notes text default null,
  p_unit_cost numeric default null,
  p_lot_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti
as $$
declare
  v_delta numeric(14,3);
  v_balance numeric(14,3);
  v_id uuid;
begin
  if auth.uid() is null or not ciadi_ti.has_support_access() then
    raise exception 'Acesso não autorizado ao módulo de stock.' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'A quantidade deve ser superior a zero.' using errcode = '22023';
  end if;
  if p_movement_type not in (
    'entrada','saida','ajuste_positivo','ajuste_negativo',
    'devolucao_entrada','devolucao_saida','transferencia_entrada','transferencia_saida'
  ) then
    raise exception 'Tipo de movimento inválido.' using errcode = '22023';
  end if;
  v_delta := case
    when p_movement_type in ('entrada','ajuste_positivo','devolucao_entrada','transferencia_entrada') then p_quantity
    else -p_quantity
  end;
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text || ':' || p_warehouse_id::text, 0));
  if not exists (select 1 from ciadi_ti.items where id = p_item_id and active = true) then
    raise exception 'Artigo inexistente ou inactivo.' using errcode = '23503';
  end if;
  if not exists (select 1 from ciadi_ti.warehouses where id = p_warehouse_id and active = true) then
    raise exception 'Armazém inexistente ou inactivo.' using errcode = '23503';
  end if;
  if v_delta < 0 then
    select coalesce(sum(quantity_delta),0) into v_balance
    from ciadi_ti.stock_movements
    where item_id = p_item_id and warehouse_id = p_warehouse_id;
    if v_balance + v_delta < 0 then
      raise exception 'Stock insuficiente.' using errcode = '23514';
    end if;
  end if;
  insert into ciadi_ti.stock_movements(
    item_id, warehouse_id, movement_type, quantity_delta, unit_cost,
    lot_code, reference, notes, created_by
  ) values (
    p_item_id, p_warehouse_id, p_movement_type, v_delta, p_unit_cost,
    p_lot_code, p_reference, p_notes, auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

grant execute on function ciadi_ti.has_support_access() to authenticated;
grant execute on function ciadi_ti.post_stock_movement(uuid,uuid,text,numeric,text,text,numeric,text) to authenticated;
