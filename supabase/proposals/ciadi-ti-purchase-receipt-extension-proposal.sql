-- CIADI: proposta aditiva para recepção física de mercadorias.
-- Estado: proposta para revisão; NÃO executar no Supabase remoto nesta fase.
-- Reutiliza requisições, linhas, armazéns, razão de movimentos e auditoria existentes.
-- Não cria tabelas, livros, políticas RLS nem concede permissões.

begin;

alter table ciadi_ti.purchase_requests add column if not exists warehouse_id uuid references ciadi_ti.warehouses(id) on delete restrict;
alter table ciadi_ti.purchase_requests add column if not exists cost_center_id uuid references public.finance_centros_custo(id) on delete restrict;
alter table ciadi_ti.purchase_requests add column if not exists priority text not null default 'normal';

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'purchase_requests_priority_check'
      and conrelid = 'ciadi_ti.purchase_requests'::regclass
  ) then
    alter table ciadi_ti.purchase_requests
      add constraint purchase_requests_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent'));
  end if;
end;
$constraints$;

alter table ciadi_ti.stock_movements add column if not exists purchase_request_id uuid references ciadi_ti.purchase_requests(id) on delete restrict;
alter table ciadi_ti.stock_movements add column if not exists purchase_request_line_id uuid references ciadi_ti.purchase_request_lines(id) on delete restrict;
alter table ciadi_ti.stock_movements add column if not exists idempotency_key text;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stock_movements_purchase_request_pair_check'
      and conrelid = 'ciadi_ti.stock_movements'::regclass
  ) then
    alter table ciadi_ti.stock_movements
      add constraint stock_movements_purchase_request_pair_check
      check (
        (purchase_request_id is null and purchase_request_line_id is null)
        or
        (purchase_request_id is not null and purchase_request_line_id is not null)
      );
  end if;
end;
$constraints$;

create unique index if not exists stock_movements_idempotency_key_uidx
  on ciadi_ti.stock_movements (idempotency_key)
  where idempotency_key is not null;

create index if not exists stock_movements_purchase_request_line_idx
  on ciadi_ti.stock_movements (purchase_request_id, purchase_request_line_id)
  where purchase_request_id is not null;

comment on column ciadi_ti.purchase_requests.warehouse_id is
  'Armazém de destino da requisição; o polo é obtido de ciadi_ti.warehouses.polo.';
comment on column ciadi_ti.purchase_requests.cost_center_id is
  'Centro de custo existente em public.finance_centros_custo; não duplicar código/nome.';
comment on column ciadi_ti.stock_movements.purchase_request_id is
  'Ligação do movimento de entrada à requisição original.';
comment on column ciadi_ti.stock_movements.purchase_request_line_id is
  'Ligação do movimento de entrada à linha original da requisição.';
comment on column ciadi_ti.stock_movements.idempotency_key is
  'Chave única para impedir duplicação de uma operação de recepção.';

create or replace function ciadi_ti.receive_purchase_request_line(
  p_request_id uuid,
  p_line_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_delivery_reference text,
  p_idempotency_key text,
  p_notes text default null,
  p_unit_cost numeric default null,
  p_lot_code text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $receipt$
declare
  v_request ciadi_ti.purchase_requests%rowtype;
  v_line ciadi_ti.purchase_request_lines%rowtype;
  v_existing ciadi_ti.stock_movements%rowtype;
  v_received numeric(14,3);
  v_quantity numeric(14,3);
  v_movement_id uuid;
  v_reference text := trim(coalesce(p_delivery_reference, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
begin
  if auth.uid() is null then
    raise exception 'É necessária uma sessão autenticada.' using errcode = '42501';
  end if;
  if not ciadi_ti.has_support_access() then
    raise exception 'A recepção de mercadorias ainda não está autorizada para este perfil.' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity <= 0 then
    raise exception 'A quantidade recebida deve ser superior a zero.' using errcode = '22023';
  end if;
  v_quantity := round(p_quantity, 3);
  if v_quantity <> p_quantity then
    raise exception 'A quantidade não pode exceder três casas decimais.' using errcode = '22023';
  end if;
  if p_unit_cost is not null and (p_unit_cost = 'NaN'::numeric or p_unit_cost < 0) then
    raise exception 'O custo unitário não pode ser negativo.' using errcode = '22023';
  end if;
  if length(v_reference) not between 2 and 100 then
    raise exception 'Indique uma referência válida da guia/documento de entrega.' using errcode = '22023';
  end if;
  if length(v_key) not between 8 and 128 then
    raise exception 'A chave idempotente é obrigatória.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select * into v_existing
  from ciadi_ti.stock_movements
  where idempotency_key = v_key;

  if found then
    if v_existing.purchase_request_id = p_request_id
       and v_existing.purchase_request_line_id = p_line_id
       and v_existing.warehouse_id = p_warehouse_id
       and v_existing.quantity_delta = v_quantity
       and v_existing.reference = v_reference then
      return v_existing.id;
    end if;
    raise exception 'A chave idempotente já foi utilizada noutra operação.' using errcode = '23505';
  end if;

  select * into v_request
  from ciadi_ti.purchase_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Requisição não encontrada.' using errcode = 'P0002';
  end if;
  if v_request.status <> 'approved' then
    raise exception 'Só podem ser recebidas requisições aprovadas.' using errcode = '55000';
  end if;
  if v_request.warehouse_id is null or v_request.warehouse_id <> p_warehouse_id then
    raise exception 'O armazém tem de corresponder ao destino definido na requisição.' using errcode = '22023';
  end if;

  if v_request.cost_center_id is null or not exists (
    select 1 from public.finance_centros_custo
    where id = v_request.cost_center_id and ativo = true
  ) then
    raise exception 'Defina um centro de custo activo na requisição antes da recepção.' using errcode = '22023';
  end if;

  select * into v_line
  from ciadi_ti.purchase_request_lines
  where id = p_line_id and request_id = p_request_id
  for update;

  if not found then
    raise exception 'Linha não pertence à requisição indicada.' using errcode = 'P0002';
  end if;
  if v_line.item_id is null then
    raise exception 'Associe um artigo do catálogo à linha antes de receber mercadoria.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from ciadi_ti.warehouses
    where id = p_warehouse_id and active = true and nullif(trim(polo), '') is not null
  ) then
    raise exception 'O armazém de destino não existe ou está inactivo.' using errcode = '23503';
  end if;
  if not exists (
    select 1 from ciadi_ti.items
    where id = v_line.item_id and active = true
  ) then
    raise exception 'O artigo não existe ou está inactivo.' using errcode = '23503';
  end if;

  select coalesce(sum(quantity_delta), 0)::numeric(14,3)
    into v_received
  from ciadi_ti.stock_movements
  where purchase_request_id = p_request_id
    and purchase_request_line_id = p_line_id
    and movement_type = 'entrada';

  if v_received + v_quantity > v_line.quantity then
    raise exception 'A quantidade recebida excede a quantidade ainda em falta.' using errcode = '23514';
  end if;

  insert into ciadi_ti.stock_movements (
    item_id, warehouse_id, movement_type, quantity_delta, unit_cost,
    lot_code, reference, notes, created_by,
    purchase_request_id, purchase_request_line_id, idempotency_key
  ) values (
    v_line.item_id, p_warehouse_id, 'entrada', v_quantity, p_unit_cost,
    p_lot_code, v_reference, p_notes, auth.uid(),
    p_request_id, p_line_id, v_key
  ) returning id into v_movement_id;

  -- O estado só passa a received quando todas as linhas estão integralmente recebidas.
  -- Enquanto houver saldo em qualquer linha, mantém approved e permite recepção parcial.
  if not exists (
    select 1
    from ciadi_ti.purchase_request_lines l
    where l.request_id = p_request_id
      and (
        l.item_id is null
        or l.quantity > coalesce((
          select sum(m.quantity_delta)
          from ciadi_ti.stock_movements m
          where m.purchase_request_id = p_request_id
            and m.purchase_request_line_id = l.id
            and m.movement_type = 'entrada'
        ), 0)
      )
  ) then
    update ciadi_ti.purchase_requests
    set status = 'received', updated_at = now()
    where id = p_request_id and status = 'approved';
  end if;

  return v_movement_id;
end;
$receipt$;

-- A função permanece fechada até à revisão e aprovação formal das permissões.
-- O predicado actual limita-a a admin/gestor/Suporte Informático.
revoke execute on function ciadi_ti.receive_purchase_request_line(
  uuid, uuid, uuid, numeric, text, text, text, numeric, text
) from public, anon, authenticated;

commit;
