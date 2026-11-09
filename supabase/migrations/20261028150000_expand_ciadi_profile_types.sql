-- CIADI: ampliar os tipos de perfil reconhecidos.
-- IMPORTANTE: migration preparada para revisão; não aplicar automaticamente em produção.
-- Esta migration não cria permissões RLS nem concede privilégios. As políticas e
-- funções de autorização por perfil/polo devem ser revistas separadamente.
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
  );

commit;
