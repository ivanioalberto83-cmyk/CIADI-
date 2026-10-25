-- CIADI security audit (READ ONLY)
-- Run in Supabase SQL Editor with an administrative role.
-- This script only SELECTs catalog metadata; it does not change data, grants, policies, or functions.
begin read only;

-- 1. View definitions and security_invoker option (where supported by this PostgreSQL version)
select schemaname, viewname, definition
from pg_views
where schemaname = 'public'
  and viewname in ('v_ciadi_at_pacientes_atribuidos','v_ciadi_calendario_aniversarios')
order by viewname;

select c.relname as view_name, c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and c.relname in ('v_ciadi_at_pacientes_atribuidos','v_ciadi_calendario_aniversarios');

-- 2. Effective function attributes and EXECUTE grants for flagged RPCs
select n.nspname as schema_name, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as identity_arguments,
       p.prosecdef as security_definer,
       p.provolatile as volatility,
       p.proconfig as function_config,
       r.rolname as grantee, a.privilege_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a
join pg_roles r on r.oid = a.grantee
where n.nspname = 'public'
  and p.proname in ('ciadi_registrar_acesso_validacao',
                    'ciadi_registrar_triagem_publica',
                    'ciadi_registrar_validacao_documento',
                    'finance_bloquear_alteracao_fiscal')
order by p.proname, r.rolname;

-- 3. RLS status and policies for sensitive tables
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
       pol.polname as policy_name, pol.polcmd as command,
       pol.polroles, pol.polqual, pol.polwithcheck
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy pol on pol.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind in ('r','p')
  and c.relname in ('ciadi_atribuicoes_at','pacientes','profissionais',
                    'ciadi_aniversarios','ciadi_documentos_validacao',
                    'ciadi_triagens','documentos_clinicos')
order by c.relname, pol.polname;

-- 4. Table/view grants to anon and authenticated for relevant objects
select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated')
  and table_name in ('v_ciadi_at_pacientes_atribuidos',
                     'v_ciadi_calendario_aniversarios',
                     'ciadi_atribuicoes_at','pacientes','profissionais',
                     'ciadi_aniversarios','ciadi_documentos_validacao',
                     'ciadi_triagens','documentos_clinicos')
order by table_name, grantee, privilege_type;

rollback;
