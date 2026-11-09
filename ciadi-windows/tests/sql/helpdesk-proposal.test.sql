-- Executar apenas após bootstrap-helpdesk.sql e aplicação da proposta.
insert into auth.users(id) values
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002');
insert into public.perfis(id,ativo,tipo) values
 ('10000000-0000-4000-8000-000000000001',true,'suporte_informatica'),
 ('10000000-0000-4000-8000-000000000002',true,'profissional');
do $$
begin
  if not has_schema_privilege('authenticated','ciadi_ti','USAGE') then
    raise exception 'authenticated precisa de USAGE no schema ciadi_ti.';
  end if;
  if not has_table_privilege('authenticated','ciadi_ti.helpdesk_tickets','SELECT,INSERT,UPDATE') then
    raise exception 'authenticated precisa de SELECT, INSERT e UPDATE nos chamados (RLS limita as linhas).';
  end if;
  if not has_table_privilege('authenticated','ciadi_ti.helpdesk_ticket_events','SELECT,INSERT') then
    raise exception 'authenticated precisa de SELECT e INSERT no histórico.';
  end if;
  if has_table_privilege('authenticated','ciadi_ti.helpdesk_tickets','DELETE')
     or has_table_privilege('authenticated','ciadi_ti.helpdesk_ticket_events','UPDATE,DELETE') then
    raise exception 'O cliente não pode eliminar chamados nem alterar/eliminar eventos.';
  end if;
  if has_table_privilege('anon','ciadi_ti.helpdesk_tickets','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon','ciadi_ti.helpdesk_ticket_events','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'O perfil anon não deve ter privilégios nas tabelas do Helpdesk.';
  end if;
end;
$$;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
insert into ciadi_ti.helpdesk_tickets
  (title,description,category,priority,location,created_by)
values
  ('Falha de rede no polo','Sem ligação à rede desde a manhã.','network','high','Talatona',
   '10000000-0000-4000-8000-000000000001');
select id,ticket_number,status from ciadi_ti.helpdesk_tickets;
select count(*) from ciadi_ti.helpdesk_ticket_events where event_type='ticket_created';
reset role;

-- O isolamento RLS impede outro utilizador autenticado de consultar o chamado.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $rls$
begin
  if (select count(*) from ciadi_ti.helpdesk_tickets) <> 0 then
    raise exception 'Um utilizador sem relação com o chamado não pode consultá-lo.';
  end if;
  if (select count(*) from ciadi_ti.helpdesk_ticket_events) <> 0 then
    raise exception 'Um utilizador sem relação com o chamado não pode consultar o histórico.';
  end if;
end;
$rls$;
reset role;

select 'CIADI helpdesk SQL homologation: PASS' as result;
