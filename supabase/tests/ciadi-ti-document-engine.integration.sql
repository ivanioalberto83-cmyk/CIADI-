\set ON_ERROR_STOP on

-- Support user can create a draft.
insert into public.perfis(id, tipo, ativo)
values ('00000000-0000-0000-0000-000000000001', 'suporte_informatica', true);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
insert into ciadi_ti.documents(document_type_code, title, payload)
values ('REL', 'Relatório de teste', '{"purpose":"isolated-postgres-test"}'::jsonb)
returning id \gset draft_
reset role;

-- Simulate the server-side PDF upload metadata.
insert into storage.objects(bucket_id, name, metadata)
values (
  'ciadi-ti-documentos',
  'suporte-informatica/' || :'draft_id' || '.pdf',
  '{"mimetype":"application/pdf","size":1024}'::jsonb
);

-- The prepare endpoint stores only the hash of a short-lived QR token.
insert into ciadi_ti.document_issuance_sessions (
  document_id, actor_id, token_hash, expires_at
)
values (
  :'draft_id'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  repeat('b', 64),
  now() + interval '10 minutes'
);

-- Only the server role can invoke the issuance function.
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
begin
  select * into v_doc
  from ciadi_ti.documents
  where title = 'Relatório de teste';

  if v_doc.status <> 'issued'
     or v_doc.document_number !~ '^SUP-REL/[0-9]{4}/[0-9]{6}
end
$$;

-- Authenticated support users can read module records, but cannot mutate an
-- issued document through the ordinary RLS update policy.
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

-- The database trigger also blocks privileged direct mutation of issued rows.
do $$
begin
  begin
    update ciadi_ti.documents
    set title = 'Alteração privilegiada'
    where title = 'Relatório de teste';
    raise exception 'Expected immutable-document trigger to reject update';
  exception
    when raise_exception then
      if sqlerrm = 'Expected immutable-document trigger to reject update' then
        raise;
      end if;
  end;
end
$$;

-- A user without an active support profile sees no module records and cannot
-- create drafts.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', false);
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from ciadi_ti.documents;
  if v_count <> 0 then
    raise exception 'User without support profile can read CI documents';
  end if;

  begin
    insert into ciadi_ti.documents(document_type_code, title)
    values ('REL', 'Não autorizado');
    raise exception 'Expected RLS to reject draft creation';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- Exactly one issued event should exist for the test document.
do $$
begin
  if (select count(*) from ciadi_ti.document_events
      where document_id = (select id from ciadi_ti.documents where title = 'Relatório de teste') and event_type = 'issued') <> 1 then
    raise exception 'Expected exactly one issued event';
  end if;
end
$$;

select 'CIADI TI document engine PostgreSQL integration checks passed' as result;

     or v_doc.sha256 <> repeat('a', 64)
     or v_doc.verification_token_hash <> repeat('b', 64)
     or v_doc.file_size_bytes <> 1024 then
    raise exception 'Issued document fields did not persist as expected';
  end if;
  if (select consumed_at is null from ciadi_ti.document_issuance_sessions
      where document_id = v_doc.id and token_hash = repeat('b', 64)) then
    raise exception 'Issuance session token was not consumed';
  end if;
end
$$;

-- Authenticated support users can read module records, but cannot mutate an
-- issued document through the ordinary RLS update policy.
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

-- The database trigger also blocks privileged direct mutation of issued rows.
do $$
begin
  begin
    update ciadi_ti.documents
    set title = 'Alteração privilegiada'
    where title = 'Relatório de teste';
    raise exception 'Expected immutable-document trigger to reject update';
  exception
    when raise_exception then
      if sqlerrm = 'Expected immutable-document trigger to reject update' then
        raise;
      end if;
  end;
end
$$;

-- A user without an active support profile sees no module records and cannot
-- create drafts.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', false);
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from ciadi_ti.documents;
  if v_count <> 0 then
    raise exception 'User without support profile can read CI documents';
  end if;

  begin
    insert into ciadi_ti.documents(document_type_code, title)
    values ('REL', 'Não autorizado');
    raise exception 'Expected RLS to reject draft creation';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- Exactly one issued event should exist for the test document.
do $$
begin
  if (select count(*) from ciadi_ti.document_events
      where document_id = (select id from ciadi_ti.documents where title = 'Relatório de teste') and event_type = 'issued') <> 1 then
    raise exception 'Expected exactly one issued event';
  end if;
end
$$;

select 'CIADI TI document engine PostgreSQL integration checks passed' as result;
