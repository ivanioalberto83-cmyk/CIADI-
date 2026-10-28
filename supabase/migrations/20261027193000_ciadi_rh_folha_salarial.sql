-- CIADI RH — folha salarial e recibos individuais
-- PROPOSTA PARA HOMOLOGAÇÃO. NÃO aplicar em produção sem backup validado,
-- atribuição explícita de polos, revisão de RLS e autorização da Direção.
-- IRT/INSS são valores validados pelo responsável contabilístico; esta migração
-- não codifica taxas fiscais nem declara conformidade legal.
begin;

create table if not exists public.ciadi_folhas_salariais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.finance_empresas(id) on delete restrict,
  centro_custo_id uuid not null references public.finance_centros_custo(id) on delete restrict,
  periodo_ano smallint not null check (periodo_ano between 2000 and 2200),
  periodo_mes smallint not null check (periodo_mes between 1 and 12),
  estado text not null default 'rascunho'
    check (estado in ('rascunho','aprovada','paga','cancelada')),
  data_pagamento date null,
  moeda text not null default 'AOA',
  total_bruto numeric(18,2) not null default 0 check (total_bruto >= 0),
  total_descontos numeric(18,2) not null default 0 check (total_descontos >= 0),
  total_liquido numeric(18,2) not null default 0 check (total_liquido >= 0),
  observacoes text null,
  criado_por uuid references public.perfis(id) on delete set null,
  aprovado_por uuid references public.perfis(id) on delete set null,
  aprovado_em timestamptz null,
  pago_por uuid references public.perfis(id) on delete set null,
  pago_em timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, centro_custo_id, periodo_ano, periodo_mes),
  check (round(total_bruto - total_descontos, 2) = total_liquido)
);

create table if not exists public.ciadi_folha_salarial_linhas (
  id uuid primary key default gen_random_uuid(),
  folha_id uuid not null references public.ciadi_folhas_salariais(id) on delete restrict,
  funcionario_id uuid not null references public.ciadi_funcionarios(id) on delete restrict,
  salario_base numeric(18,2) not null check (salario_base >= 0),
  subsidios jsonb not null default '{}'::jsonb,
  total_subsidios numeric(18,2) not null default 0 check (total_subsidios >= 0),
  horas_extra numeric(10,2) not null default 0 check (horas_extra >= 0),
  valor_horas_extra numeric(18,2) not null default 0 check (valor_horas_extra >= 0),
  descontos jsonb not null default '{}'::jsonb,
  irt numeric(18,2) not null default 0 check (irt >= 0),
  inss numeric(18,2) not null default 0 check (inss >= 0),
  outros_descontos numeric(18,2) not null default 0 check (outros_descontos >= 0),
  deducao_faltas numeric(18,2) not null default 0 check (deducao_faltas >= 0),
  total_bruto numeric(18,2) not null check (total_bruto >= 0),
  total_descontos numeric(18,2) not null check (total_descontos >= 0),
  total_liquido numeric(18,2) not null check (total_liquido >= 0),
  numero_recibo text null unique,
  recibo_emitido_em timestamptz null,
  recibo_emitido_por uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (folha_id, funcionario_id),
  check (round(salario_base + total_subsidios + valor_horas_extra, 2) = total_bruto),
  check (round(irt + inss + outros_descontos + deducao_faltas, 2) = total_descontos),
  check (round(total_bruto - total_descontos, 2) = total_liquido)
);

create index if not exists ciadi_folhas_salariais_centro_periodo_idx
  on public.ciadi_folhas_salariais(centro_custo_id, periodo_ano desc, periodo_mes desc);
create index if not exists ciadi_folha_salarial_linhas_folha_idx
  on public.ciadi_folha_salarial_linhas(folha_id);
create index if not exists ciadi_folha_salarial_linhas_funcionario_idx
  on public.ciadi_folha_salarial_linhas(funcionario_id);

alter table public.ciadi_folhas_salariais enable row level security;
alter table public.ciadi_folha_salarial_linhas enable row level security;

drop policy if exists ciadi_folhas_salariais_assigned_read on public.ciadi_folhas_salariais;
create policy ciadi_folhas_salariais_assigned_read
  on public.ciadi_folhas_salariais for select to authenticated
  using (
    public.ciadi_finance_is_staff()
    and exists (
      select 1 from public.ciadi_centros_acesso a
      where a.perfil_id = (select auth.uid())
        and a.centro_custo_id = ciadi_folhas_salariais.centro_custo_id
        and a.ativo = true
    )
  );

drop policy if exists ciadi_folhas_salariais_draft_insert on public.ciadi_folhas_salariais;
create policy ciadi_folhas_salariais_draft_insert
  on public.ciadi_folhas_salariais for insert to authenticated
  with check (
    public.ciadi_finance_is_staff()
    and estado = 'rascunho'
    and criado_por = (select auth.uid())
    and exists (
      select 1 from public.ciadi_centros_acesso a
      where a.perfil_id = (select auth.uid())
        and a.centro_custo_id = ciadi_folhas_salariais.centro_custo_id
        and a.ativo = true
    )
  );

drop policy if exists ciadi_folhas_salariais_draft_update on public.ciadi_folhas_salariais;
create policy ciadi_folhas_salariais_draft_update
  on public.ciadi_folhas_salariais for update to authenticated
  using (
    public.ciadi_finance_is_staff() and estado = 'rascunho'
    and exists (select 1 from public.ciadi_centros_acesso a
      where a.perfil_id=(select auth.uid()) and a.centro_custo_id=ciadi_folhas_salariais.centro_custo_id and a.ativo=true)
  )
  with check (
    public.ciadi_finance_is_staff() and estado = 'rascunho'
    and exists (select 1 from public.ciadi_centros_acesso a
      where a.perfil_id=(select auth.uid()) and a.centro_custo_id=ciadi_folhas_salariais.centro_custo_id and a.ativo=true)
  );

drop policy if exists ciadi_folha_salarial_linhas_assigned_read on public.ciadi_folha_salarial_linhas;
create policy ciadi_folha_salarial_linhas_assigned_read
  on public.ciadi_folha_salarial_linhas for select to authenticated
  using (
    public.ciadi_finance_is_staff()
    and exists (
      select 1 from public.ciadi_folhas_salariais f
      join public.ciadi_centros_acesso a on a.centro_custo_id = f.centro_custo_id
      where f.id = ciadi_folha_salarial_linhas.folha_id
        and a.perfil_id = (select auth.uid()) and a.ativo = true
    )
  );

drop policy if exists ciadi_folha_salarial_linhas_draft_insert on public.ciadi_folha_salarial_linhas;
create policy ciadi_folha_salarial_linhas_draft_insert
  on public.ciadi_folha_salarial_linhas for insert to authenticated
  with check (
    public.ciadi_finance_is_staff()
    and exists (
      select 1 from public.ciadi_folhas_salariais f
      join public.ciadi_centros_acesso a on a.centro_custo_id = f.centro_custo_id
      where f.id = ciadi_folha_salarial_linhas.folha_id
        and f.estado = 'rascunho' and a.perfil_id = (select auth.uid()) and a.ativo = true
    )
  );

drop policy if exists ciadi_folha_salarial_linhas_draft_update on public.ciadi_folha_salarial_linhas;
create policy ciadi_folha_salarial_linhas_draft_update
  on public.ciadi_folha_salarial_linhas for update to authenticated
  using (
    public.ciadi_finance_is_staff()
    and exists (select 1 from public.ciadi_folhas_salariais f
      join public.ciadi_centros_acesso a on a.centro_custo_id=f.centro_custo_id
      where f.id=ciadi_folha_salarial_linhas.folha_id and f.estado='rascunho'
        and a.perfil_id=(select auth.uid()) and a.ativo=true)
  )
  with check (
    public.ciadi_finance_is_staff()
    and exists (select 1 from public.ciadi_folhas_salariais f
      join public.ciadi_centros_acesso a on a.centro_custo_id=f.centro_custo_id
      where f.id=ciadi_folha_salarial_linhas.folha_id and f.estado='rascunho'
        and a.perfil_id=(select auth.uid()) and a.ativo=true)
  );

drop policy if exists ciadi_folha_salarial_linhas_draft_delete on public.ciadi_folha_salarial_linhas;
create policy ciadi_folha_salarial_linhas_draft_delete
  on public.ciadi_folha_salarial_linhas for delete to authenticated
  using (
    public.ciadi_finance_is_staff()
    and exists (select 1 from public.ciadi_folhas_salariais f
      where f.id = ciadi_folha_salarial_linhas.folha_id and f.estado = 'rascunho')
  );

grant select, insert, update on public.ciadi_folhas_salariais to authenticated;
grant select, insert, update, delete on public.ciadi_folha_salarial_linhas to authenticated;
revoke delete on public.ciadi_folhas_salariais from authenticated;

create or replace function public.ciadi_rh_aprovar_folha(p_folha_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare f public.ciadi_folhas_salariais%rowtype; n integer;
begin
  if not public.ciadi_finance_is_staff() then raise exception 'Acesso não autorizado'; end if;
  select * into f from public.ciadi_folhas_salariais where id=p_folha_id for update;
  if not found then raise exception 'Folha salarial não encontrada'; end if;
  if not exists (select 1 from public.ciadi_centros_acesso a where a.perfil_id=auth.uid() and a.centro_custo_id=f.centro_custo_id and a.ativo=true) then
    raise exception 'O utilizador não tem acesso autorizado ao polo/centro de custo desta folha';
  end if;
  if f.estado <> 'rascunho' then raise exception 'Só uma folha em rascunho pode ser aprovada'; end if;
  select count(*) into n from public.ciadi_folha_salarial_linhas where folha_id=f.id;
  if n=0 then raise exception 'A folha não contém colaboradores'; end if;
  update public.ciadi_folhas_salariais f0
    set total_bruto=x.total_bruto, total_descontos=x.total_descontos,
        total_liquido=x.total_liquido, estado='aprovada',
        aprovado_por=auth.uid(), aprovado_em=now(), updated_at=now()
  from (select coalesce(sum(total_bruto),0)::numeric(18,2) total_bruto,
               coalesce(sum(total_descontos),0)::numeric(18,2) total_descontos,
               coalesce(sum(total_liquido),0)::numeric(18,2) total_liquido
        from public.ciadi_folha_salarial_linhas where folha_id=f.id) x
  where f0.id=f.id;
  return jsonb_build_object('ok',true,'folha_id',f.id,'estado','aprovada','linhas',n);
end
$function$;

create or replace function public.ciadi_rh_marcar_folha_paga(p_folha_id uuid, p_data_pagamento date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare f public.ciadi_folhas_salariais%rowtype;
begin
  if not public.ciadi_finance_is_staff() then raise exception 'Acesso não autorizado'; end if;
  select * into f from public.ciadi_folhas_salariais where id=p_folha_id for update;
  if not found then raise exception 'Folha salarial não encontrada'; end if;
  if not exists (select 1 from public.ciadi_centros_acesso a where a.perfil_id=auth.uid() and a.centro_custo_id=f.centro_custo_id and a.ativo=true) then
    raise exception 'O utilizador não tem acesso autorizado ao polo/centro de custo desta folha';
  end if;
  if f.estado <> 'aprovada' then raise exception 'Só uma folha aprovada pode ser marcada como paga'; end if;
  if p_data_pagamento is null then raise exception 'A data de pagamento é obrigatória'; end if;
  update public.ciadi_folhas_salariais set estado='paga', data_pagamento=p_data_pagamento,
    pago_por=auth.uid(), pago_em=now(), updated_at=now() where id=f.id;
  return jsonb_build_object('ok',true,'folha_id',f.id,'estado','paga','data_pagamento',p_data_pagamento);
end
$function$;

create or replace function public.ciadi_rh_emitir_recibo(p_linha_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare l public.ciadi_folha_salarial_linhas%rowtype; f public.ciadi_folhas_salariais%rowtype; v_numero text;
begin
  if not public.ciadi_finance_is_staff() then raise exception 'Acesso não autorizado'; end if;
  select * into l from public.ciadi_folha_salarial_linhas where id=p_linha_id for update;
  if not found then raise exception 'Linha salarial não encontrada'; end if;
  select * into f from public.ciadi_folhas_salariais where id=l.folha_id;
  if f.estado not in ('aprovada','paga') then raise exception 'O recibo só pode ser emitido depois da aprovação da folha'; end if;
  if not exists (select 1 from public.ciadi_centros_acesso a where a.perfil_id=auth.uid() and a.centro_custo_id=f.centro_custo_id and a.ativo=true) then
    raise exception 'O utilizador não tem acesso autorizado ao polo/centro de custo deste recibo';
  end if;
  v_numero := coalesce(l.numero_recibo, 'CIADI-RH-' || f.periodo_ano::text || lpad(f.periodo_mes::text,2,'0') || '-' || upper(substr(l.id::text,1,8)));
  update public.ciadi_folha_salarial_linhas set numero_recibo=v_numero,
    recibo_emitido_em=coalesce(recibo_emitido_em,now()),
    recibo_emitido_por=coalesce(recibo_emitido_por,auth.uid()), updated_at=now()
  where id=l.id;
  return jsonb_build_object('ok',true,'linha_id',l.id,'folha_id',f.id,'numero_recibo',v_numero,'emitido_em',now());
end
$function$;

revoke all on function public.ciadi_rh_aprovar_folha(uuid) from public, anon;
revoke all on function public.ciadi_rh_marcar_folha_paga(uuid,date) from public, anon;
revoke all on function public.ciadi_rh_emitir_recibo(uuid) from public, anon;
grant execute on function public.ciadi_rh_aprovar_folha(uuid) to authenticated;
grant execute on function public.ciadi_rh_marcar_folha_paga(uuid,date) to authenticated;
grant execute on function public.ciadi_rh_emitir_recibo(uuid) to authenticated;

commit;
