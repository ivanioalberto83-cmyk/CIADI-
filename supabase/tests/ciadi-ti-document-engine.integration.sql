\set ON_ERROR_STOP on

insert into public.perfis(id, tipo, ativo)
values ('00000000-0000-0000-0000-000000000001', 'suporte_informatica', true);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
insert into ciadi_ti.documents(document_type_code, title, payload)
values ('REL', 'Relatório de teste', '{"purpose":"isolated-postgres-test"}'::jsonb)
returning id \gset draft_
reset role;

-- Prepare the QR token and reserve the official number before rendering the PDF.
set role service_role;
select ciadi_ti.prepare_document_issuance(
  :'draft_id'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  repeat('b', 64)
) as reserved_number \gset
reset role;

-- Simulate the final PDF upload after the QR and reserved number were rendered into it.
insert into storage.objects(bucket_id, name, metadata)
values (
  'ciadi-ti-documentos',
  'suporte-informatica/' || :'draft_id' || '.pdf',
  '{"mimetype":"application/pdf","size":1024}'::jsonb
);

-- The trusted server consumes the prepared QR session and issues the document.
set role service_role;
select ciadi_ti.issue_document(
  :'draft_id'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  repeat('a', 64),
  repeat('b', 64),
  1024
) as issued_number \gset
reset role;

do $$
declare
  v_doc ciadi_ti.documents%rowtype;
  v_session ciadi_ti.document_issuance_sessions%rowtype;
begin
  select * into v_doc from ciadi_ti.documents where title = 'Relatório de teste';
  select * into v_session from ciadi_ti.document_issuance_sessions where document_id = v_doc.id;
  if v_doc.status <> 'issued'
     or left(v_doc.document_number, 7) <> 'SUP-REL'
     or length(v_doc.document_number) <> 19
     or v_doc.document_number <> v_session.reserved_number
     or v_doc.sha256 <> repeat('a', 64)
     or v_doc.verification_token_hash <> repeat('b', 64)
     or v_doc.file_size_bytes <> 1024 then
    raise exception 'Issued document fields did not persist as expected';
  end if;
  if v_session.consumed_at is null then
    raise exception 'Issuance session token was not consumed';
  end if;
end
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
update ciadi_ti.documents set title = 'Tentativa de alteração' where id = :'draft_id'::uuid;
reset role;

do $$
begin
  if (select title from ciadi_ti.documents where title = 'Relatório de teste') <> 'Relatório de teste' then
    raise exception 'RLS allowed an issued document to be changed';
  end if;
end
$$;

do $$
begin
  begin
    update ciadi_ti.documents set title = 'Alteração privilegiada' where title = 'Relatório de teste';
    raise exception 'Expected immutable-document trigger to reject update';
  exception
    when raise_exception then
      if sqlerrm = 'Expected immutable-document trigger to reject update' then raise; end if;
  end;
end
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', false);
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from ciadi_ti.documents;
  if v_count <> 0 then raise exception 'User without support profile can read CI documents'; end if;
  begin
    insert into ciadi_ti.documents(document_type_code, title) values ('REL', 'Não autorizado');
    raise exception 'Expected RLS to reject draft creation';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

do $$
begin
  if (select count(*) from ciadi_ti.document_events
      where document_id = (select id from ciadi_ti.documents where title = 'Relatório de teste')
        and event_type = 'issued') <> 1 then
    raise exception 'Expected exactly one issued event';
  end if;
end
$$;

select 'CIADI TI document engine PostgreSQL integration checks passed' as result;