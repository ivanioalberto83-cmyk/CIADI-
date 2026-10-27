-- CIADI: centros de custo e permissões por utilizador
-- FASE 1 (aditiva): preparar catálogo e atribuições. Não aplicar em produção sem backup,
-- revisão das políticas e migração de centro_id nas tabelas operacionais.
-- Não reatribui documentos, despesas ou clientes existentes.

begin;

-- Normaliza o código histórico apenas se não existir outro registo CC-001 após trim.
do $$
begin
  if exists (
    select 1 from public.finance_centros_custo
    where btrim(codigo) = 'CC-001'
  ) and (
    select count(*) from public.finance_centros_custo
    where btrim(codigo) = 'CC-001'
  ) = 1 then
    update public.finance_centros_custo
       set codigo = 'CC-001',
           updated_at = now()
     where codigo <> 'CC-001'
       and btrim(codigo) = 'CC-001';
  end if;
end $$;

-- Regista Jardim de Rosas sem criar duplicado se a migração for repetida.
insert into public.finance_centros_custo (codigo, nome, descricao, ativo)
select 'CC-002', 'CIADI POLO JARDIM DE ROSAS',
       'Centro de custo operacional do Polo Jardim de Rosas.', true
where not exists (
  select 1 from public.finance_centros_custo
  where btrim(codigo) = 'CC-002'
);

-- Relação explícita entre perfil autenticado e centros autorizados.
create table if not exists public.ciadi_centros_acesso (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  centro_custo_id uuid not null references public.finance_centros_custo(id) on delete restrict,
  ativo boolean not null default true,
  principal boolean not null default false,
  criado_por uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ciadi_centros_acesso_perfil_centro_unique unique (perfil_id, centro_custo_id)
);

create index if not exists ciadi_centros_acesso_perfil_ativo_idx
  on public.ciadi_centros_acesso (perfil_id, ativo);
create index if not exists ciadi_centros_acesso_centro_ativo_idx
  on public.ciadi_centros_acesso (centro_custo_id, ativo);

alter table public.ciadi_centros_acesso enable row level security;
grant select, insert, update, delete on public.ciadi_centros_acesso to authenticated;

-- Cada utilizador pode consultar apenas as próprias atribuições.
drop policy if exists ciadi_centros_acesso_self_read on public.ciadi_centros_acesso;
create policy ciadi_centros_acesso_self_read
  on public.ciadi_centros_acesso
  for select to authenticated
  using (perfil_id = (select auth.uid()));

-- A gestão das atribuições fica limitada aos utilizadores reconhecidos como staff.
drop policy if exists ciadi_centros_acesso_staff_manage on public.ciadi_centros_acesso;
create policy ciadi_centros_acesso_staff_manage
  on public.ciadi_centros_acesso
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Os utilizadores só conseguem listar centros ativos que lhes foram atribuídos.
drop policy if exists ciadi_centros_custo_assigned_read on public.finance_centros_custo;
create policy ciadi_centros_custo_assigned_read
  on public.finance_centros_custo
  for select to authenticated
  using (
    ativo = true
    and exists (
      select 1
      from public.ciadi_centros_acesso a
      where a.centro_custo_id = finance_centros_custo.id
        and a.perfil_id = (select auth.uid())
        and a.ativo = true
    )
  );

commit;

-- IMPORTANTE:
-- Esta fase ainda NÃO isola linhas financeiras: as tabelas de clientes/documentos/despesas
-- não têm todas um centro_custo_id UUID. Antes de ativar o seletor na aplicação,
-- auditar e adicionar a associação às tabelas operacionais e criar políticas RLS específicas.
-- Não atribuir registos históricos automaticamente; requer decisão administrativa por registo.
