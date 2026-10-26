-- CIADI+ SOS Realtime (homologação)
-- Migration aditiva: publica ciadi_sos_alertas para Supabase Realtime.
-- Não altera dados nem modifica políticas RLS/permissões.
-- Aplicar primeiro em homologação e validar a autorização de leitura existente.
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'ciadi_sos_alertas'
  ) then
    alter publication supabase_realtime add table public.ciadi_sos_alertas;
  end if;
end $$;
