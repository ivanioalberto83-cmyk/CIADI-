-- CIADI ERP — compras e contabilização de despesas
-- PROPOSTA PARA HOMOLOGAÇÃO. NÃO executar em produção sem backup validado,
-- reconciliação dos registos e autorização final da Direção.
begin;

alter table public.finance_despesas
  add column if not exists fornecedor_id uuid null,
  add column if not exists aprovacao_estado text not null default 'pendente',
  add column if not exists aprovado_por uuid null,
  add column if not exists aprovado_em timestamptz null,
  add column if not exists contabilizacao_estado text not null default 'pendente';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'finance_despesas_fornecedor_id_fkey') then
    alter table public.finance_despesas
      add constraint finance_despesas_fornecedor_id_fkey
      foreign key (fornecedor_id) references public.finance_clientes(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finance_despesas_aprovado_por_fkey') then
    alter table public.finance_despesas
      add constraint finance_despesas_aprovado_por_fkey
      foreign key (aprovado_por) references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finance_despesas_aprovacao_estado_check') then
    alter table public.finance_despesas
      add constraint finance_despesas_aprovacao_estado_check
      check (aprovacao_estado in ('pendente','aprovada','rejeitada'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finance_despesas_contabilizacao_estado_check') then
    alter table public.finance_despesas
      add constraint finance_despesas_contabilizacao_estado_check
      check (contabilizacao_estado in ('pendente','contabilizada'));
  end if;
end $$;

create index if not exists idx_finance_despesas_fornecedor_id
  on public.finance_despesas(fornecedor_id);
create index if not exists idx_finance_despesas_aprovacao_estado
  on public.finance_despesas(aprovacao_estado);

-- A migração aborta em vez de ocultar lançamentos duplicados preexistentes.
do $$
begin
  if exists (
    select 1 from public.finance_lancamentos
    where despesa_id is not null
    group by despesa_id having count(*) > 1
  ) then
    raise exception 'Migração bloqueada: existem despesas com mais de um lançamento contabilístico; reconciliar antes.';
  end if;
end $$;

create unique index if not exists uq_finance_lancamentos_despesa
  on public.finance_lancamentos(despesa_id)
  where despesa_id is not null;

create table if not exists public.finance_compras_ordens (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  empresa_id uuid not null references public.finance_empresas(id) on delete restrict,
  fornecedor_id uuid not null references public.finance_clientes(id) on delete restrict,
  requisicao_referencia text null,
  data_ordem date not null default current_date,
  data_prevista date null,
  estado text not null default 'rascunho'
    check (estado in ('rascunho','submetida','aprovada','rejeitada','enviada','parcialmente_recebida','recebida','cancelada')),
  subtotal numeric(18,2) not null default 0 check (subtotal >= 0),
  imposto numeric(18,2) not null default 0 check (imposto >= 0),
  total numeric(18,2) not null default 0 check (total >= 0),
  observacoes text null,
  criado_por uuid null references auth.users(id) on delete set null,
  aprovado_por uuid null references auth.users(id) on delete set null,
  aprovado_em timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, numero)
);

create table if not exists public.finance_compras_ordem_linhas (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.finance_compras_ordens(id) on delete cascade,
  descricao text not null,
  quantidade numeric(18,3) not null check (quantidade > 0),
  quantidade_recebida numeric(18,3) not null default 0 check (quantidade_recebida >= 0),
  preco_unitario numeric(18,2) not null check (preco_unitario >= 0),
  total_linha numeric(18,2) not null check (total_linha >= 0),
  created_at timestamptz not null default now(),
  check (quantidade_recebida <= quantidade)
);

create index if not exists idx_finance_compras_ordens_empresa_data
  on public.finance_compras_ordens(empresa_id, data_ordem desc);
create index if not exists idx_finance_compras_ordens_fornecedor
  on public.finance_compras_ordens(fornecedor_id);
create index if not exists idx_finance_compras_ordens_estado
  on public.finance_compras_ordens(estado);
create index if not exists idx_finance_compras_linhas_ordem
  on public.finance_compras_ordem_linhas(ordem_id);

alter table public.finance_compras_ordens enable row level security;
alter table public.finance_compras_ordem_linhas enable row level security;

drop policy if exists ciadi_finance_compras_ordens_staff on public.finance_compras_ordens;
create policy ciadi_finance_compras_ordens_staff
  on public.finance_compras_ordens for all to authenticated
  using (public.ciadi_finance_is_staff())
  with check (public.ciadi_finance_is_staff());

drop policy if exists ciadi_finance_compras_linhas_staff on public.finance_compras_ordem_linhas;
create policy ciadi_finance_compras_linhas_staff
  on public.finance_compras_ordem_linhas for all to authenticated
  using (public.ciadi_finance_is_staff())
  with check (public.ciadi_finance_is_staff());

grant select, insert, update, delete on public.finance_compras_ordens to authenticated;
grant select, insert, update, delete on public.finance_compras_ordem_linhas to authenticated;

create or replace function public.finance_aprovar_despesa(p_despesa_id uuid, p_aprovar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare d public.finance_despesas%rowtype;
begin
  if not public.ciadi_finance_is_staff() then raise exception 'Acesso não autorizado'; end if;
  select * into d from public.finance_despesas where id = p_despesa_id for update;
  if not found then raise exception 'Despesa não encontrada'; end if;
  if d.contabilizacao_estado = 'contabilizada' then
    raise exception 'Despesa já contabilizada; não pode alterar a aprovação';
  end if;
  if d.estado = 'anulado' then raise exception 'Despesa anulada não pode ser aprovada'; end if;
  update public.finance_despesas
    set aprovacao_estado = case when p_aprovar then 'aprovada' else 'rejeitada' end,
        aprovado_por = auth.uid(),
        aprovado_em = now(),
        updated_at = now()
    where id = p_despesa_id;
  return jsonb_build_object('ok', true, 'id', p_despesa_id,
    'aprovacao_estado', case when p_aprovar then 'aprovada' else 'rejeitada' end);
end
$function$;

create or replace function public.finance_postar_despesa(p_despesa_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  d public.finance_despesas%rowtype;
  regra public.finance_regras_contabilizacao%rowtype;
  diario uuid;
  periodo uuid;
  lanc uuid;
  total_debito numeric(18,2);
begin
  if not public.ciadi_finance_is_staff() then raise exception 'Acesso não autorizado'; end if;

  select * into d from public.finance_despesas where id = p_despesa_id for update;
  if not found then raise exception 'Despesa não encontrada'; end if;
  if d.estado = 'anulado' then raise exception 'Despesa anulada não pode ser contabilizada'; end if;
  if d.aprovacao_estado <> 'aprovada' then raise exception 'A despesa precisa de aprovação antes da contabilização'; end if;
  if d.empresa_id is null then raise exception 'Despesa sem empresa associada'; end if;
  if d.fornecedor_id is null then raise exception 'Associe a despesa a um fornecedor do cadastro antes de contabilizar'; end if;
  if round(coalesce(d.valor,0) + coalesce(d.imposto,0),2) <> round(coalesce(d.total,0),2) then
    raise exception 'Valores inconsistentes: valor + imposto deve ser igual ao total';
  end if;
  if d.total <= 0 then raise exception 'Total da despesa deve ser superior a zero'; end if;

  select id into lanc from public.finance_lancamentos where despesa_id = d.id;
  if lanc is not null then
    if exists (select 1 from public.finance_lancamentos where id = lanc and estado = 'contabilizado') then
      update public.finance_despesas set contabilizacao_estado = 'contabilizada' where id = d.id;
      return lanc;
    end if;
    raise exception 'Já existe um lançamento para esta despesa; reconciliar antes de repetir';
  end if;

  select id into periodo from public.finance_periodos_contabeis
   where d.data_documento between data_inicio and data_fim
     and empresa_id is not distinct from d.empresa_id and estado <> 'fechado'
   order by data_inicio desc limit 1;
  if periodo is null then raise exception 'Não existe período contabilístico aberto para a data da despesa'; end if;

  select id into diario from public.finance_diarios
   where empresa_id is not distinct from d.empresa_id and ativo = true and codigo = 'COM'
   limit 1;
  if diario is null then raise exception 'Configure o diário COM para compras antes de contabilizar'; end if;

  select * into regra from public.finance_regras_contabilizacao
   where empresa_id is not distinct from d.empresa_id and ativo = true
     and operacao = 'DESPESA' and tipo_documento is null
   order by prioridade asc limit 1;
  if regra.id is null or regra.conta_debito_id is null or regra.conta_credito_id is null then
    raise exception 'Configure a regra contabilística DESPESA com contas de débito e crédito';
  end if;
  if coalesce(d.imposto,0) > 0 and regra.conta_imposto_id is null then
    raise exception 'A despesa tem imposto; configure a conta contabilística do imposto';
  end if;

  total_debito := coalesce(d.valor,0) + coalesce(d.imposto,0);
  insert into public.finance_lancamentos
    (data_lancamento, descricao, referencia, despesa_id, conta_debito_id, conta_credito_id,
     valor, centro_custo, criado_por, empresa_id, diario_id, periodo_id, estado, origem_tipo, origem_id)
  values
    (d.data_documento,
     'Contabilização da despesa ' || coalesce(d.documento_referencia, d.id::text),
     d.documento_referencia, d.id, regra.conta_debito_id, regra.conta_credito_id,
     d.total, d.centro_custo, auth.uid(), d.empresa_id, diario, periodo, 'rascunho', 'DESPESA', d.id)
  returning id into lanc;

  if coalesce(d.valor,0) > 0 then
    insert into public.finance_lancamento_linhas
      (lancamento_id, conta_id, centro_custo_id, descricao, debito, credito, ordem)
    values (lanc, regra.conta_debito_id, regra.centro_custo_id, 'Despesa operacional', d.valor, 0, 1);
  end if;
  if coalesce(d.imposto,0) > 0 then
    insert into public.finance_lancamento_linhas
      (lancamento_id, conta_id, centro_custo_id, descricao, debito, credito, ordem)
    values (lanc, regra.conta_imposto_id, regra.centro_custo_id, 'Imposto dedutível conforme regra configurada', d.imposto, 0, 2);
  end if;
  insert into public.finance_lancamento_linhas
    (lancamento_id, conta_id, centro_custo_id, descricao, debito, credito, ordem)
  values (lanc, regra.conta_credito_id, regra.centro_custo_id, 'Fornecedor / contas a pagar', d.total, d.total, 3);

  perform public.finance_validar_lancamento(lanc);
  update public.finance_despesas
    set contabilizacao_estado = 'contabilizada', updated_at = now()
    where id = d.id;
  return lanc;
end
$function$;

grant execute on function public.finance_aprovar_despesa(uuid, boolean) to authenticated;
grant execute on function public.finance_postar_despesa(uuid) to authenticated;

commit;
