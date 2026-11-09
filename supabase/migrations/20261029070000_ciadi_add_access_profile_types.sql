-- CIADI — prepara os tipos de perfil usados pela matriz de acessos.
-- IMPORTANTE: ficheiro de preparação; NÃO aplicar em produção até existir backup
-- Supabase restaurável verificado e revisão explícita das políticas RLS.
-- Mantém 'gestor' aceite para não invalidar registos históricos; a interface
-- não o oferece para novas atribuições operacionais.
begin;

alter table public.perfis
  drop constraint if exists perfis_tipo_check;

alter table public.perfis
  add constraint perfis_tipo_check
  check (
    tipo = any (
      array[
        'admin'::text,
        'gestor'::text,
        'profissional'::text,
        'paciente'::text,
        'responsavel'::text,
        'operador'::text,
        'suporte_informatica'::text,
        'rh'::text,
        'rececao'::text
      ]
    )
  )
  not valid;

-- Validação explícita para impedir que a migração seja considerada pronta
-- se já existirem tipos fora da lista prevista.
alter table public.perfis validate constraint perfis_tipo_check;

commit;
