-- CIADI P0 security regression checks
-- READ-ONLY catalog assertions. Run ONLY against an isolated development database.
-- This script deliberately FAILS while the audited insecure policies/grants remain.
-- It does not insert, update, delete, create, alter, or drop any database object.

BEGIN READ ONLY;

DO $ciadi_p0$
DECLARE
  v_policy record;
  v_count integer;
  v_bad_columns text;
  v_function_bodies text;
BEGIN
  -- A. Anonymous knowledge access must be explicitly restricted to public content.
  SELECT count(*)
    INTO v_count
    FROM pg_policies p
   WHERE p.schemaname = 'public'
     AND p.tablename = 'ciadi_conhecimentos'
     AND p.cmd = 'SELECT'
     AND ('anon' = ANY (p.roles) OR 'public' = ANY (p.roles))
     AND (
       coalesce(p.qual, '') !~* 'publico'
       OR coalesce(p.qual, '') !~* 'ativo'
     );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'P0 FAIL: ciadi_conhecimentos still has an anonymous/public SELECT policy without both public-classification and active-state predicates';
  END IF;

  SELECT count(*)
    INTO v_count
    FROM pg_policies p
   WHERE p.schemaname = 'public'
     AND p.tablename = 'ciadi_conhecimentos'
     AND p.cmd = 'SELECT'
     AND ('anon' = ANY (p.roles) OR 'public' = ANY (p.roles));

  IF v_count = 0 THEN
    RAISE NOTICE 'A PASS: no anonymous/public SELECT policy exists on ciadi_conhecimentos (public access is fully closed)';
  ELSE
    RAISE NOTICE 'A PASS: anonymous knowledge SELECT policy is explicitly scoped by classification and active state';
  END IF;

  -- B. Anonymous recruitment INSERT must not accept server-managed fields.
  SELECT string_agg(c.column_name, ', ' ORDER BY c.column_name)
    INTO v_bad_columns
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name = 'recrutamento_candidaturas'
     AND c.column_name IN (
       'estado',
       'codigo_candidatura',
       'cv_storage_path',
       'email_enviado_at',
       'email_erro'
     )
     AND has_column_privilege('anon', 'public.recrutamento_candidaturas', c.column_name, 'INSERT');

  IF v_bad_columns IS NOT NULL THEN
    RAISE EXCEPTION 'P0 FAIL: anon still has INSERT privileges on server-managed recruitment columns: %', v_bad_columns;
  END IF;

  RAISE NOTICE 'B PASS: anon has no INSERT privilege on recruitment state, code, CV path or email-processing fields';

  -- C. No generic is_staff() policy may grant broad access to private documents.
  SELECT count(*)
    INTO v_count
    FROM pg_policies p
   WHERE p.schemaname = 'storage'
     AND p.tablename = 'objects'
     AND coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') ~* 'is_staff\s*\('
     AND coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') ~* 'documentos';

  IF v_count > 0 THEN
    RAISE EXCEPTION 'P0 FAIL: storage.objects still contains a generic is_staff() policy mentioning the documentos bucket';
  END IF;

  RAISE NOTICE 'C PASS: no generic is_staff() policy grants access to the documentos bucket';

  -- D. Public app-update bucket must not be writable by generic staff policy.
  SELECT count(*)
    INTO v_count
    FROM pg_policies p
   WHERE p.schemaname = 'storage'
     AND p.tablename = 'objects'
     AND coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') ~* 'is_staff\s*\('
     AND coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') ~* 'ciadi-app-updates'
     AND p.cmd IN ('INSERT', 'UPDATE', 'ALL');

  IF v_count > 0 THEN
    RAISE EXCEPTION 'P0 FAIL: ciadi-app-updates still allows generic is_staff() writes/updates';
  END IF;

  RAISE NOTICE 'D PASS: no generic is_staff() write/update policy remains on ciadi-app-updates';

  -- E. Faturação issuance must not rely on the broad is_staff() helper.
  SELECT string_agg(pg_get_functiondef(p.oid), E'\n')
    INTO v_function_bodies
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'ciadi_faturacao_emitir_documento';

  IF v_function_bodies IS NOT NULL AND v_function_bodies ~* 'is_staff\s*\(' THEN
    RAISE EXCEPTION 'P0 FAIL: ciadi_faturacao_emitir_documento still relies on is_staff()';
  END IF;

  IF v_function_bodies IS NULL THEN
    RAISE NOTICE 'E REVIEW: ciadi_faturacao_emitir_documento not found in this schema snapshot; verify function inventory';
  ELSE
    RAISE NOTICE 'E PASS: no broad is_staff() check found in ciadi_faturacao_emitir_documento (review specific finance authorization separately)';
  END IF;

  RAISE NOTICE 'CIADI P0 catalog regression checks completed. These checks do not replace row-level integration tests with synthetic identities.';
END
$ciadi_p0$;

ROLLBACK;
