-- CIADI Aprovisionamento profissional — proposta de esquema para homologação
-- DEPENDÊNCIA: supabase/migrations/20261027070000_ciadi_centros_custo_acesso.sql
-- NÃO aplicar em produção sem backup restaurável, revisão de dependências e autorização.
-- Não cria registos demonstrativos nem altera tabelas comerciais/contabilísticas existentes.

begin;

create or replace function public.ciadi_aprov_tem_acesso(p_centro_custo_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    exists (
      select 1 from public.perfis p
      where p.id = auth.uid()
        and p.ativo = true
        and lower(coalesce(p.tipo,'')) = 'admin'
    )
    or exists (
      select 1 from public.ciadi_centros_acesso a
      where a.perfil_id = auth.uid()
        and a.centro_custo_id = p_centro_custo_id
        and a.ativo = true
    );
$$;

create table if not exists public.ciadi_aprov_pedidos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  centro_custo_id uuid not null references public.finance_centros_custo(id) on delete restrict,
  requisitante_id uuid not null references public.perfis(id) on delete restrict,
  categoria text not null default 'geral',
  prioridade text not null default 'normal' check (prioridade in ('baixa','normal','alta','urgente')),
  justificacao text not null,
  estado text not null default 'rascunho' check (estado in ('rascunho','submetido','em_validacao','aprovado','rejeitado','parcialmente_atendido','atendido','cancelado')),
  observacoes text,
  aprovado_por uuid references public.perfis(id) on delete restrict,
  aprovado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ciadi_aprov_pedido_linhas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.ciadi_aprov_pedidos(id) on delete cascade,
  descricao text not null,
  quantidade numeric(14,3) not null check (quantidade > 0),
  unidade text not null default 'unidade',
  artigo_id uuid,
  quantidade_atendida numeric(14,3) not null default 0 check (quantidade_atendida >= 0),
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists public.ciadi_aprov_artigos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nome text not null,
  categoria text not null default 'geral',
  unidade text not null default 'unidade',
  stock_minimo numeric(14,3) not null default 0 check (stock_minimo >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (codigo)
);

create table if not exists public.ciadi_aprov_stock (
  id uuid primary key default gen_random_uuid(),
  artigo_id uuid not null references public.ciadi_aprov_artigos(id) on delete restrict,
  centro_custo_id uuid not null references public.finance_centros_custo(id) on delete restrict,
  quantidade numeric(14,3) not null default 0 check (quantidade >= 0),
  updated_at timestamptz not null default now(),
  unique (artigo_id, centro_custo_id)
);

create table if not exists public.ciadi_aprov_movimentos (
  id uuid primary key default gen_random_uuid(),
  artigo_id uuid not null references public.ciadi_aprov_artigos(id) on delete restrict,
  centro_custo_id uuid not null references public.finance_centros_custo(id) on delete restrict,
  tipo text not null check (tipo in ('entrada','saida','ajuste_positivo','ajuste_negativo','transferencia_entrada','transferencia_saida','devolucao')),
  quantidade numeric(14,3) not null check (quantidade > 0),
  documento_referencia text,
  lote text,
  validade date,
  motivo text,
  criado_por uuid not null references public.perfis(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.ciadi_aprov_cotacoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.ciadi_aprov_pedidos(id) on delete cascade,
  fornecedor_id uuid not null references public.finance_clientes(id) on delete restrict,
  valor_total numeric(18,2) not null check (valor_total >= 0),
  moeda text not null default 'AOA',
  prazo_entrega text,
  selecionada boolean not null default false,
  documento_url text,
  justificacao_selecao text,
  observacoes text,
  registado_por uuid not null references public.perfis(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.ciadi_aprov_rececoes (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  ordem_compra_id uuid references public.finance_compras_ordens(id) on delete restrict,
  pedido_id uuid references public.ciadi_aprov_pedidos(id) on delete restrict,
  centro_custo_id uuid not null references public.finance_centros_custo(id) on delete restrict,
  data_rececao date not null default current_date,
  estado text not null default 'conferida' check (estado in ('rascunho','conferida','com_divergencias','cancelada')),
  observacoes text,
  recebido_por uuid not null references public.perfis(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ordem_compra_id is not null or pedido_id is not null)
);

create table if not exists public.ciadi_aprov_rececao_linhas (
  id uuid primary key default gen_random_uuid(),
  rececao_id uuid not null references public.ciadi_aprov_rececoes(id) on delete cascade,
  artigo_id uuid references public.ciadi_aprov_artigos(id) on delete restrict,
  descricao text not null,
  quantidade_esperada numeric(14,3) not null default 0 check (quantidade_esperada >= 0),
  quantidade_recebida numeric(14,3) not null check (quantidade_recebida >= 0),
  quantidade_rejeitada numeric(14,3) not null default 0 check (quantidade_rejeitada >= 0),
  observacoes text
);

create table if not exists public.ciadi_aprov_patrimonio (
  id uuid primary key default gen_random_uuid(),
  codigo_inventario text not null unique,
  descricao text not null,
  categoria text not null default 'equipamento',
  numero_serie text,
  centro_custo_id uuid not null references public.finance_centros_custo(id) on delete restrict,
  localizacao text,
  responsavel_id uuid references public.perfis(id) on delete restrict,
  data_aquisicao date,
  valor_aquisicao numeric(18,2) check (valor_aquisicao is null or valor_aquisicao >= 0),
  garantia_ate date,
  estado text not null default 'operacional' check (estado in ('operacional','em_manutencao','danificado','abatido','desaparecido')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ciadi_aprov_manutencoes (
  id uuid primary key default gen_random_uuid(),
  patrimonio_id uuid not null references public.ciadi_aprov_patrimonio(id) on delete restrict,
  centro_custo_id uuid not null references public.finance_centros_custo(id) on delete restrict,
  tipo text not null default 'preventiva' check (tipo in ('preventiva','corretiva')),
  descricao text not null,
  data_prevista date,
  data_realizada date,
  custo numeric(18,2) check (custo is null or custo >= 0),
  fornecedor_id uuid references public.finance_clientes(id) on delete restrict,
  estado text not null default 'planeada' check (estado in ('planeada','agendada','concluida','cancelada')),
  observacoes text,
  criado_por uuid not null references public.perfis(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists ciadi_aprov_pedidos_centro_estado_idx on public.ciadi_aprov_pedidos(centro_custo_id, estado, created_at desc);
create index if not exists ciadi_aprov_stock_centro_idx on public.ciadi_aprov_stock(centro_custo_id, artigo_id);
create index if not exists ciadi_aprov_movimentos_centro_data_idx on public.ciadi_aprov_movimentos(centro_custo_id, created_at desc);
create index if not exists ciadi_aprov_rececoes_centro_data_idx on public.ciadi_aprov_rececoes(centro_custo_id, data_rececao desc);
create index if not exists ciadi_aprov_patrimonio_centro_idx on public.ciadi_aprov_patrimonio(centro_custo_id, estado);

alter table public.ciadi_aprov_pedidos enable row level security;
alter table public.ciadi_aprov_pedido_linhas enable row level security;
alter table public.ciadi_aprov_artigos enable row level security;
alter table public.ciadi_aprov_stock enable row level security;
alter table public.ciadi_aprov_movimentos enable row level security;
alter table public.ciadi_aprov_cotacoes enable row level security;
alter table public.ciadi_aprov_rececoes enable row level security;
alter table public.ciadi_aprov_rececao_linhas enable row level security;
alter table public.ciadi_aprov_patrimonio enable row level security;
alter table public.ciadi_aprov_manutencoes enable row level security;

-- Pedidos: o requerente só consulta os seus próprios pedidos, além dos utilizadores com acesso ao polo.
drop policy if exists ciadi_aprov_pedidos_select on public.ciadi_aprov_pedidos;
create policy ciadi_aprov_pedidos_select on public.ciadi_aprov_pedidos for select to authenticated
using (public.ciadi_aprov_tem_acesso(centro_custo_id) or requisitante_id = auth.uid());
drop policy if exists ciadi_aprov_pedidos_insert on public.ciadi_aprov_pedidos;
create policy ciadi_aprov_pedidos_insert on public.ciadi_aprov_pedidos for insert to authenticated
with check (requisitante_id = auth.uid() and public.ciadi_aprov_tem_acesso(centro_custo_id));
drop policy if exists ciadi_aprov_pedidos_update on public.ciadi_aprov_pedidos;
create policy ciadi_aprov_pedidos_update on public.ciadi_aprov_pedidos for update to authenticated
using (public.ciadi_aprov_tem_acesso(centro_custo_id) and estado in ('rascunho','submetido','em_validacao'))
with check (public.ciadi_aprov_tem_acesso(centro_custo_id));
drop policy if exists ciadi_aprov_pedidos_delete on public.ciadi_aprov_pedidos;
create policy ciadi_aprov_pedidos_delete on public.ciadi_aprov_pedidos for delete to authenticated
using (public.ciadi_aprov_tem_acesso(centro_custo_id) and estado = 'rascunho');

-- Linhas e cotações são limitadas ao polo do pedido principal.
drop policy if exists ciadi_aprov_pedido_linhas_all on public.ciadi_aprov_pedido_linhas;
create policy ciadi_aprov_pedido_linhas_all on public.ciadi_aprov_pedido_linhas for all to authenticated
using (exists(select 1 from public.ciadi_aprov_pedidos p where p.id=pedido_id and public.ciadi_aprov_tem_acesso(p.centro_custo_id)))
with check (exists(select 1 from public.ciadi_aprov_pedidos p where p.id=pedido_id and public.ciadi_aprov_tem_acesso(p.centro_custo_id)));
drop policy if exists ciadi_aprov_cotacoes_all on public.ciadi_aprov_cotacoes;
create policy ciadi_aprov_cotacoes_all on public.ciadi_aprov_cotacoes for all to authenticated
using (exists(select 1 from public.ciadi_aprov_pedidos p where p.id=pedido_id and public.ciadi_aprov_tem_acesso(p.centro_custo_id)))
with check (exists(select 1 from public.ciadi_aprov_pedidos p where p.id=pedido_id and public.ciadi_aprov_tem_acesso(p.centro_custo_id)));

-- Artigos são um catálogo partilhado; só administradores e gestores com pelo menos um polo atribuído podem gerir o catálogo.
drop policy if exists ciadi_aprov_artigos_select on public.ciadi_aprov_artigos;
create policy ciadi_aprov_artigos_select on public.ciadi_aprov_artigos for select to authenticated
using (exists(select 1 from public.perfis p where p.id=auth.uid() and p.ativo=true and lower(coalesce(p.tipo,'')) in ('admin','gestor')));
drop policy if exists ciadi_aprov_artigos_manage on public.ciadi_aprov_artigos;
create policy ciadi_aprov_artigos_manage on public.ciadi_aprov_artigos for all to authenticated
using (exists(select 1 from public.perfis p where p.id=auth.uid() and p.ativo=true and lower(coalesce(p.tipo,''))='admin'))
with check (exists(select 1 from public.perfis p where p.id=auth.uid() and p.ativo=true and lower(coalesce(p.tipo,''))='admin'));

-- Stock, movimentos, receções, património e manutenção ficam sempre limitados ao centro autorizado.
drop policy if exists ciadi_aprov_stock_all on public.ciadi_aprov_stock;
create policy ciadi_aprov_stock_all on public.ciadi_aprov_stock for all to authenticated
using (public.ciadi_aprov_tem_acesso(centro_custo_id))
with check (public.ciadi_aprov_tem_acesso(centro_custo_id));
drop policy if exists ciadi_aprov_movimentos_all on public.ciadi_aprov_movimentos;
create policy ciadi_aprov_movimentos_all on public.ciadi_aprov_movimentos for all to authenticated
using (public.ciadi_aprov_tem_acesso(centro_custo_id))
with check (public.ciadi_aprov_tem_acesso(centro_custo_id));
drop policy if exists ciadi_aprov_rececoes_all on public.ciadi_aprov_rececoes;
create policy ciadi_aprov_rececoes_all on public.ciadi_aprov_rececoes for all to authenticated
using (public.ciadi_aprov_tem_acesso(centro_custo_id))
with check (public.ciadi_aprov_tem_acesso(centro_custo_id));
drop policy if exists ciadi_aprov_rececao_linhas_all on public.ciadi_aprov_rececao_linhas;
create policy ciadi_aprov_rececao_linhas_all on public.ciadi_aprov_rececao_linhas for all to authenticated
using (exists(select 1 from public.ciadi_aprov_rececoes r where r.id=rececao_id and public.ciadi_aprov_tem_acesso(r.centro_custo_id)))
with check (exists(select 1 from public.ciadi_aprov_rececoes r where r.id=rececao_id and public.ciadi_aprov_tem_acesso(r.centro_custo_id)));
drop policy if exists ciadi_aprov_patrimonio_all on public.ciadi_aprov_patrimonio;
create policy ciadi_aprov_patrimonio_all on public.ciadi_aprov_patrimonio for all to authenticated
using (public.ciadi_aprov_tem_acesso(centro_custo_id))
with check (public.ciadi_aprov_tem_acesso(centro_custo_id));
drop policy if exists ciadi_aprov_manutencoes_all on public.ciadi_aprov_manutencoes;
create policy ciadi_aprov_manutencoes_all on public.ciadi_aprov_manutencoes for all to authenticated
using (public.ciadi_aprov_tem_acesso(centro_custo_id))
with check (public.ciadi_aprov_tem_acesso(centro_custo_id));

commit;
