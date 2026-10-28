create sequence if not exists public.ciadi_recibo_salarial_seq start 1;

create table if not exists public.ciadi_folhas_salariais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.finance_empresas(id),
  centro_custo_id uuid not null references public.finance_centros_custo(id),
  periodo_ano integer not null check (periodo_ano between 2000 and 2200),
  periodo_mes integer not null check (periodo_mes between 1 and 12),
  estado text not null default 'rascunho' check (estado in ('rascunho','aprovada','paga','anulada')),
  moeda text not null default 'AOA',
  data_pagamento date,
  total_bruto numeric(14,2) not null default 0 check (total_bruto >= 0),
  total_descontos numeric(14,2) not null default 0 check (total_descontos >= 0),
  total_liquido numeric(14,2) not null default 0 check (total_liquido >= 0),
  observacoes text,
  criado_por uuid references public.perfis(id),
  aprovado_por uuid references public.perfis(id),
  aprovado_em timestamptz,
  atualizado_por uuid references public.perfis(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, centro_custo_id, periodo_ano, periodo_mes)
);

create table if not exists public.ciadi_folha_salarial_linhas (
  id uuid primary key default gen_random_uuid(),
  folha_id uuid not null references public.ciadi_folhas_salariais(id) on delete cascade,
  funcionario_id uuid not null references public.ciadi_funcionarios(id),
  salario_base numeric(14,2) not null check (salario_base >= 0),
  subsidios jsonb not null default '{}'::jsonb,
  total_subsidios numeric(14,2) not null default 0 check (total_subsidios >= 0),
  horas_extra numeric(10,2) not null default 0 check (horas_extra >= 0),
  valor_horas_extra numeric(14,2) not null default 0 check (valor_horas_extra >= 0),
  irt numeric(14,2) not null default 0 check (irt >= 0),
  inss numeric(14,2) not null default 0 check (inss >= 0),
  inss_entidade numeric(14,2) not null default 0 check (inss_entidade >= 0),
  outros_descontos numeric(14,2) not null default 0 check (outros_descontos >= 0),
  deducao_faltas numeric(14,2) not null default 0 check (deducao_faltas >= 0),
  descontos jsonb not null default '{}'::jsonb,
  total_bruto numeric(14,2) not null check (total_bruto >= 0),
  total_descontos numeric(14,2) not null check (total_descontos >= 0),
  total_liquido numeric(14,2) not null check (total_liquido >= 0),
  numero_recibo text unique,
  breakdown_calculo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (folha_id, funcionario_id)
);

create index if not exists idx_ciadi_folhas_salariais_periodo on public.ciadi_folhas_salariais(periodo_ano desc, periodo_mes desc);
create index if not exists idx_ciadi_folhas_salariais_centro on public.ciadi_folhas_salariais(centro_custo_id);
create index if not exists idx_ciadi_folha_linhas_folha on public.ciadi_folha_salarial_linhas(folha_id);
create index if not exists idx_ciadi_folha_linhas_funcionario on public.ciadi_folha_salarial_linhas(funcionario_id);

alter table public.ciadi_folhas_salariais enable row level security;
alter table public.ciadi_folha_salarial_linhas enable row level security;

drop policy if exists ciadi_folhas_salariais_manager_select on public.ciadi_folhas_salariais;
create policy ciadi_folhas_salariais_manager_select on public.ciadi_folhas_salariais for select to authenticated using (
  exists (select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo=true and p.tipo in ('admin','gestor'))
);
drop policy if exists ciadi_folhas_salariais_manager_insert on public.ciadi_folhas_salariais;
create policy ciadi_folhas_salariais_manager_insert on public.ciadi_folhas_salariais for insert to authenticated with check (
  exists (select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo=true and p.tipo in ('admin','gestor'))
);
drop policy if exists ciadi_folhas_salariais_manager_update on public.ciadi_folhas_salariais;
create policy ciadi_folhas_salariais_manager_update on public.ciadi_folhas_salariais for update to authenticated using (
  exists (select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo=true and p.tipo in ('admin','gestor'))
) with check (
  exists (select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo=true and p.tipo in ('admin','gestor'))
);
drop policy if exists ciadi_folhas_salariais_manager_delete on public.ciadi_folhas_salariais;
create policy ciadi_folhas_salariais_manager_delete on public.ciadi_folhas_salariais for delete to authenticated using (
  exists (select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo=true and p.tipo='admin')
);

drop policy if exists ciadi_folha_linhas_manager_select on public.ciadi_folha_salarial_linhas;
create policy ciadi_folha_linhas_manager_select on public.ciadi_folha_salarial_linhas for select to authenticated using (
  exists (select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo=true and p.tipo in ('admin','gestor'))
);
drop policy if exists ciadi_folha_linhas_manager_insert on public.ciadi_folha_salarial_linhas;
create policy ciadi_folha_linhas_manager_insert on public.ciadi_folha_salarial_linhas for insert to authenticated with check (
  exists (select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo=true and p.tipo in ('admin','gestor'))
);
drop policy if exists ciadi_folha_linhas_manager_update on public.ciadi_folha_salarial_linhas;
create policy ciadi_folha_linhas_manager_update on public.ciadi_folha_salarial_linhas for update to authenticated using (
  exists (select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo=true and p.tipo in ('admin','gestor'))
) with check (
  exists (select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo=true and p.tipo in ('admin','gestor'))
);
drop policy if exists ciadi_folha_linhas_manager_delete on public.ciadi_folha_salarial_linhas;
create policy ciadi_folha_linhas_manager_delete on public.ciadi_folha_salarial_linhas for delete to authenticated using (
  exists (select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo=true and p.tipo='admin')
);

create or replace function public.ciadi_rh_aprovar_folha(p_folha_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_user uuid := auth.uid();
  v_sheet public.ciadi_folhas_salariais%rowtype;
  v_count integer;
  v_bruto numeric(14,2);
  v_descontos numeric(14,2);
  v_liquido numeric(14,2);
begin
  if v_user is null or not exists (select 1 from public.perfis p where p.id=v_user and p.ativo=true and p.tipo in ('admin','gestor')) then
    raise exception 'Sem autorização para aprovar folhas salariais' using errcode='42501';
  end if;
  select * into v_sheet from public.ciadi_folhas_salariais where id=p_folha_id for update;
  if not found then raise exception 'Folha não encontrada'; end if;
  if v_sheet.estado <> 'rascunho' then raise exception 'Só é possível aprovar uma folha em rascunho'; end if;
  select count(*),coalesce(sum(total_bruto),0),coalesce(sum(total_descontos),0),coalesce(sum(total_liquido),0)
    into v_count,v_bruto,v_descontos,v_liquido
    from public.ciadi_folha_salarial_linhas where folha_id=p_folha_id;
  if v_count=0 then raise exception 'Não é possível aprovar uma folha sem colaboradores'; end if;
  update public.ciadi_folhas_salariais set estado='aprovada',total_bruto=v_bruto,total_descontos=v_descontos,total_liquido=v_liquido,
    aprovado_por=v_user,aprovado_em=now(),atualizado_por=v_user,updated_at=now() where id=p_folha_id;
  return jsonb_build_object('id',p_folha_id,'estado','aprovada','colaboradores',v_count,'total_bruto',v_bruto,'total_descontos',v_descontos,'total_liquido',v_liquido);
end; $$;

create or replace function public.ciadi_rh_marcar_folha_paga(p_folha_id uuid,p_data_pagamento date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_user uuid:=auth.uid(); v_sheet public.ciadi_folhas_salariais%rowtype;
begin
  if v_user is null or not exists (select 1 from public.perfis p where p.id=v_user and p.ativo=true and p.tipo in ('admin','gestor')) then
    raise exception 'Sem autorização para registar pagamentos salariais' using errcode='42501';
  end if;
  if p_data_pagamento is null then raise exception 'Data de pagamento obrigatória'; end if;
  select * into v_sheet from public.ciadi_folhas_salariais where id=p_folha_id for update;
  if not found then raise exception 'Folha não encontrada'; end if;
  if v_sheet.estado <> 'aprovada' then raise exception 'Só é possível pagar uma folha aprovada'; end if;
  update public.ciadi_folhas_salariais set estado='paga',data_pagamento=p_data_pagamento,atualizado_por=v_user,updated_at=now() where id=p_folha_id;
  return jsonb_build_object('id',p_folha_id,'estado','paga','data_pagamento',p_data_pagamento);
end; $$;

create or replace function public.ciadi_rh_emitir_recibo(p_linha_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_user uuid:=auth.uid(); v_line public.ciadi_folha_salarial_linhas%rowtype; v_sheet public.ciadi_folhas_salariais%rowtype; v_number text;
begin
  if v_user is null or not exists (select 1 from public.perfis p where p.id=v_user and p.ativo=true and p.tipo in ('admin','gestor')) then
    raise exception 'Sem autorização para emitir recibos salariais' using errcode='42501';
  end if;
  select * into v_line from public.ciadi_folha_salarial_linhas where id=p_linha_id for update;
  if not found then raise exception 'Linha salarial não encontrada'; end if;
  select * into v_sheet from public.ciadi_folhas_salariais where id=v_line.folha_id;
  if v_sheet.estado not in ('aprovada','paga') then raise exception 'O recibo só pode ser emitido após aprovação da folha'; end if;
  if v_line.numero_recibo is not null then return jsonb_build_object('id',v_line.id,'numero_recibo',v_line.numero_recibo,'estado',v_sheet.estado); end if;
  v_number := 'CIADI-'||v_sheet.periodo_ano::text||lpad(v_sheet.periodo_mes::text,2,'0')||'-'||lpad(nextval('public.ciadi_recibo_salarial_seq')::text,6,'0');
  update public.ciadi_folha_salarial_linhas set numero_recibo=v_number,updated_at=now() where id=p_linha_id;
  return jsonb_build_object('id',p_linha_id,'numero_recibo',v_number,'estado',v_sheet.estado);
end; $$;

revoke all on function public.ciadi_rh_aprovar_folha(uuid) from public,anon;
revoke all on function public.ciadi_rh_marcar_folha_paga(uuid,date) from public,anon;
revoke all on function public.ciadi_rh_emitir_recibo(uuid) from public,anon;
grant execute on function public.ciadi_rh_aprovar_folha(uuid) to authenticated;
grant execute on function public.ciadi_rh_marcar_folha_paga(uuid,date) to authenticated;
grant execute on function public.ciadi_rh_emitir_recibo(uuid) to authenticated;
grant usage,select on sequence public.ciadi_recibo_salarial_seq to authenticated;
grant select,insert,update,delete on public.ciadi_folhas_salariais to authenticated;
grant select,insert,update,delete on public.ciadi_folha_salarial_linhas to authenticated;
