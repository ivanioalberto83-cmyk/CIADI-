\set ON_ERROR_STOP on
-- Operador: cria pedido, lê apenas o próprio e pode actualizar dados de recebimento.
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $
begin
  perform public.ciadi_reception_request_invoice_change(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','alteracao',
    'Motivo de correcção válido','{}'::jsonb
  );
  raise exception 'Falha: pedido de alteração sem descrição foi aceite';
exception when others then
  if sqlerrm = 'Falha: pedido de alteração sem descrição foi aceite' then raise; end if;
end $;
select public.ciadi_reception_request_invoice_change(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','anulacao',
 'Factura emitida com dados incorrectos','{}'::jsonb
);
do $$
begin
  if (select count(*) from ciadi_reception.invoice_change_requests) <> 1 then
    raise exception 'Operador não consegue consultar o próprio pedido';
  end if;
  begin
    perform public.ciadi_reception_decide_invoice_change(
      (select id from ciadi_reception.invoice_change_requests limit 1),
      'aprovado','Tentativa pelo operador'
    );
    raise exception 'Falha: operador conseguiu decidir pedido';
  exception when others then
    if sqlerrm = 'Falha: operador conseguiu decidir pedido' then raise; end if;
  end;
  update public.finance_documentos
    set estado_pagamento='pago', forma_pagamento='transferencia'
    where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  update public.finance_documentos
    set agt_submission_status='submetido',
        agt_validation_status='pendente',
        agt_request_id='AGT-TEST-001',
        fiscal_status='emitido'
    where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  begin
    delete from public.finance_documentos
      where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'Falha: operador conseguiu eliminar factura emitida';
  exception when others then
    if sqlerrm = 'Falha: operador conseguiu eliminar factura emitida' then raise; end if;
  end;
  begin
    update public.finance_documentos set total=1
      where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'Falha: operador conseguiu alterar total da factura';
  exception when others then
    if sqlerrm = 'Falha: operador conseguiu alterar total da factura' then raise; end if;
  end;
end $$;
reset role;

-- Apenas ADM activo decide; a decisão fica registada sem alterar a factura original.
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.ciadi_reception_decide_invoice_change(
 (select id from ciadi_reception.invoice_change_requests limit 1),
 'aprovado','Validado pelo ADM'
);
do $$
begin
  if (select status from ciadi_reception.invoice_change_requests limit 1) <> 'aprovado' then
    raise exception 'A decisão do ADM não foi registada';
  end if;
  if (select total from public.finance_documentos where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 100 then
    raise exception 'A factura original foi alterada indevidamente após aprovação';
  end if;
end $$;
reset role;
