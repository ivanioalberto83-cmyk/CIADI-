-- PROPOSTA APENAS — NÃO APLICAR EM PRODUÇÃO SEM HOMOLOGAÇÃO E AUTORIZAÇÃO.
-- Isolamento por polo nas RPCs centrais de caixa quando a caixa está atribuída à Recepção.
-- Caixas sem polo_code mantêm o comportamento legado dos restantes módulos financeiros.
-- Para caixas com polo_code, operadores têm de estar associados ao polo e só podem
-- fechar o próprio turno; admin/gestor mantém a capacidade global de supervisão.

create or replace function public.ciadi_abrir_caixa(
  p_caixa_id uuid,
  p_saldo_inicial numeric
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $open_cashbox$
declare
  v_op uuid;
  v_turno uuid;
  v_empresa uuid;
  v_polo_code text;
begin
  if not public.ciadi_finance_can('abrir') then
    raise exception 'Sem permissão para abrir caixa' using errcode = '42501';
  end if;
  if p_saldo_inicial is null or p_saldo_inicial < 0 then
    raise exception 'Saldo inicial inválido' using errcode = '22023';
  end if;

  select c.empresa_id, c.polo_code
    into v_empresa, v_polo_code
  from public.finance_caixas c
  where c.id = p_caixa_id
  for update;

  if v_empresa is null then
    raise exception 'Caixa não encontrado' using errcode = 'P0002';
  end if;

  if v_polo_code is not null
     and not public.ciadi_finance_is_staff()
     and not ciadi_ti.has_reception_operation_access(v_polo_code) then
    raise exception 'Sem acesso ao polo desta caixa' using errcode = '42501';
  end if;

  v_op := public.ciadi_finance_operator_id();
  if exists (
    select 1 from public.finance_caixa_turnos t
    where t.caixa_id = p_caixa_id
      and t.estado in ('aberto','pendente_aprovacao')
  ) then
    raise exception 'Este caixa já possui um turno aberto ou pendente' using errcode = '23505';
  end if;

  if not public.ciadi_finance_is_staff() and not exists (
    select 1 from public.finance_operadores o
    where o.id = v_op
      and o.funcao in ('operador_caixa','operador_senior','tesoureiro','gestor_financeiro','administrador')
  ) then
    raise exception 'Operador não autorizado' using errcode = '42501';
  end if;

  insert into public.finance_caixa_turnos(caixa_id,operador_id,saldo_inicial,estado)
  values(p_caixa_id,v_op,round(p_saldo_inicial,2),'aberto')
  returning id into v_turno;

  update public.finance_caixas
  set saldo_abertura=round(p_saldo_inicial,2),
      saldo_atual=round(p_saldo_inicial,2),
      aberto_em=now(),
      aberto_por=auth.uid(),
      fechado_em=null,
      fechado_por=null,
      estado='aberto',
      updated_at=now()
  where id=p_caixa_id;

  insert into public.finance_auditoria_operacoes(operador_id,caixa_id,turno_id,evento,detalhe)
  values(v_op,p_caixa_id,v_turno,'abertura',jsonb_build_object('saldo_inicial',round(p_saldo_inicial,2)));

  return v_turno;
end;
$open_cashbox$;

create or replace function public.ciadi_fechar_caixa(
  p_turno_id uuid,
  p_saldo_contado numeric,
  p_justificacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $close_cashbox$
declare
  t public.finance_caixa_turnos%rowtype;
  v_esperado numeric;
  v_diff numeric;
  v_op uuid;
  v_polo_code text;
begin
  if not public.ciadi_finance_can('fechar') then
    raise exception 'Sem permissão para fechar caixa' using errcode = '42501';
  end if;
  if p_saldo_contado is null or p_saldo_contado < 0 then
    raise exception 'Saldo contado inválido' using errcode = '22023';
  end if;

  select * into t
  from public.finance_caixa_turnos
  where id=p_turno_id
  for update;

  if t.id is null or t.estado <> 'aberto' then
    raise exception 'Turno de caixa não está aberto' using errcode = 'P0002';
  end if;

  select c.polo_code into v_polo_code
  from public.finance_caixas c
  where c.id=t.caixa_id;

  v_op := public.ciadi_finance_operator_id();
  if v_polo_code is not null
     and not public.ciadi_finance_is_staff()
     and (
       not ciadi_ti.has_reception_operation_access(v_polo_code)
       or t.operador_id is distinct from v_op
     ) then
    raise exception 'Só o operador do turno, com acesso ao polo, pode fechar esta caixa' using errcode = '42501';
  end if;

  v_esperado := coalesce(public.ciadi_tesouraria_saldo_turno(t.id),t.saldo_inicial);
  v_diff := round(p_saldo_contado-v_esperado,2);

  update public.finance_caixa_turnos
  set fechado_em=now(),
      saldo_esperado=v_esperado,
      saldo_contado=round(p_saldo_contado,2),
      diferenca=v_diff,
      justificacao_diferenca=p_justificacao,
      estado=case when abs(v_diff)<0.005 then 'fechado' else 'pendente_aprovacao' end
  where id=t.id;

  update public.finance_caixas
  set saldo_fechamento=round(p_saldo_contado,2),
      saldo_atual=case when abs(v_diff)<0.005 then round(p_saldo_contado,2) else saldo_atual end,
      fechado_em=case when abs(v_diff)<0.005 then now() else null end,
      fechado_por=case when abs(v_diff)<0.005 then auth.uid() else null end,
      estado=case when abs(v_diff)<0.005 then 'fechado' else 'aberto' end,
      updated_at=now()
  where id=t.caixa_id;

  insert into public.finance_auditoria_operacoes(operador_id,caixa_id,turno_id,evento,detalhe)
  values(v_op,t.caixa_id,t.id,'fechamento',jsonb_build_object(
    'esperado',v_esperado,'contado',p_saldo_contado,'diferenca',v_diff,
    'estado',case when abs(v_diff)<0.005 then 'fechado' else 'pendente_aprovacao' end
  ));

  return jsonb_build_object(
    'turno_id',t.id,'saldo_esperado',v_esperado,
    'saldo_contado',round(p_saldo_contado,2),'diferenca',v_diff,
    'estado',case when abs(v_diff)<0.005 then 'fechado' else 'pendente_aprovacao' end
  );
end;
$close_cashbox$;

create or replace function public.ciadi_registar_movimento_caixa(
  p_caixa_id uuid,
  p_tipo text,
  p_valor numeric,
  p_metodo_pagamento text default null,
  p_descricao text default null,
  p_documento_id uuid default null,
  p_pagamento_id uuid default null,
  p_categoria text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $cash_movement$
declare
  v_turno public.finance_caixa_turnos%rowtype;
  v_op uuid;
  v_id uuid;
  v_delta numeric;
  v_empresa uuid;
  v_polo_code text;
begin
  if not public.ciadi_finance_can('receber') then
    raise exception 'Sem permissão para registar movimento' using errcode = '42501';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'O valor deve ser maior que zero' using errcode = '22023';
  end if;
  if p_tipo is null or p_tipo not in ('entrada','saida','receita','recebimento','despesa') then
    raise exception 'Tipo de movimento inválido' using errcode = '22023';
  end if;

  if p_pagamento_id is not null and exists (
    select 1 from public.finance_movimentos_caixa m
    where m.pagamento_id=p_pagamento_id and m.estado='confirmado'
  ) then
    select m.id into v_id
    from public.finance_movimentos_caixa m
    where m.pagamento_id=p_pagamento_id and m.estado='confirmado'
    limit 1;
    return v_id;
  end if;

  select c.empresa_id,c.polo_code
    into v_empresa,v_polo_code
  from public.finance_caixas c
  where c.id=p_caixa_id;

  if v_empresa is null then
    raise exception 'Caixa não encontrado' using errcode = 'P0002';
  end if;

  if v_polo_code is not null
     and not public.ciadi_finance_is_staff()
     and not ciadi_ti.has_reception_operation_access(v_polo_code) then
    raise exception 'Sem acesso ao polo desta caixa' using errcode = '42501';
  end if;

  v_op := public.ciadi_finance_operator_id();
  select * into v_turno
  from public.finance_caixa_turnos t
  where t.caixa_id=p_caixa_id
    and t.estado='aberto'
    and (public.ciadi_finance_is_staff() or t.operador_id=v_op)
  order by t.aberto_em desc
  limit 1
  for update;

  if v_turno.id is null then
    raise exception 'Não existe turno aberto para este caixa' using errcode = 'P0002';
  end if;

  v_delta := case when p_tipo in ('entrada','receita','recebimento') then p_valor else -p_valor end;

  insert into public.finance_movimentos_caixa(
    caixa_id,turno_id,operador_id,tipo,valor,origem,documento_id,pagamento_id,
    descricao,data_movimento,criado_por,metodo_pagamento,categoria,estado
  )
  values(
    p_caixa_id,v_turno.id,v_op,p_tipo,round(p_valor,2),'operador',
    p_documento_id,p_pagamento_id,p_descricao,now(),auth.uid(),
    p_metodo_pagamento,p_categoria,'confirmado'
  )
  returning id into v_id;

  update public.finance_caixas
  set saldo_atual=coalesce(saldo_atual,0)+v_delta,updated_at=now()
  where id=p_caixa_id;

  insert into public.finance_auditoria_operacoes(operador_id,caixa_id,turno_id,movimento_id,evento,detalhe)
  values(v_op,p_caixa_id,v_turno.id,v_id,'movimento',jsonb_build_object(
    'tipo',p_tipo,'valor',round(p_valor,2),'metodo',p_metodo_pagamento
  ));

  return v_id;
end;
$cash_movement$;
