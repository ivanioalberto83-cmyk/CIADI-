-- PROPOSTA — NÃO APLICAR AUTOMATICAMENTE EM PRODUÇÃO.
-- Objetivo: permitir que public.perfis.tipo identifique suporte informático.
-- Não altera dados existentes nem políticas RLS. A aplicação requer revisão/aprovação
-- e um plano separado de autorização server-side para o serviço do agente.

begin;

alter table public.perfis
  add constraint perfis_tipo_check_v2
  check (
    tipo = any (
      array[
        'admin'::text,
        'gestor'::text,
        'profissional'::text,
        'paciente'::text,
        'responsavel'::text,
        'operador'::text,
        'suporte_informatica'::text
      ]
    )
  );

alter table public.perfis
  drop constraint perfis_tipo_check;

alter table public.perfis
  rename constraint perfis_tipo_check_v2 to perfis_tipo_check;

commit;
