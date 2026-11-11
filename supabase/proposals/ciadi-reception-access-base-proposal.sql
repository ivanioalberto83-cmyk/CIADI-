-- CIADI | Base de autorização da Recepção por polo.
-- Pré-requisito partilhado pelos motores de inventário e Recepção.
-- Sem permissões clínicas e sem alteração de is_staff().

begin;

do $preflight$
begin
  if to_regnamespace('ciadi_ti') is null then
    raise exception 'Schema ciadi_ti não existe.';
  end if;
  if to_regclass('public.perfis') is null then
    raise exception 'Tabela public.perfis não existe.';
  end if;
  if to_regprocedure('ciadi_ti.has_support_access()') is null then
    raise exception 'Função ciadi_ti.has_support_access() não existe.';
  end if;
end
$preflight$;

create table if not exists ciadi_ti.reception_user_polos (
  user_id uuid not null references public.perfis(id) on delete cascade,
  polo_code text not null check (polo_code in ('talatona','jardim_de_rosas')),
  active boolean not null default true,
  assigned_by uuid references public.perfis(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,polo_code)
);

alter table ciadi_ti.reception_user_polos enable row level security;
grant select on ciadi_ti.reception_user_polos to authenticated;
drop policy if exists ciadi_reception_user_polos_self_select on ciadi_ti.reception_user_polos;
create policy ciadi_reception_user_polos_self_select
  on ciadi_ti.reception_user_polos for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function ciadi_ti.has_reception_operation_access(p_polo_code text)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public, ciadi_ti, auth
as $function$
  select auth.uid() is not null
    and p_polo_code in ('talatona','jardim_de_rosas')
    and (
      ciadi_ti.has_support_access()
      or exists (
        select 1
        from public.perfis p
        where p.id = auth.uid()
          and p.ativo = true
          and (
            p.tipo in ('admin','gestor')
            or (
              p.tipo = 'operador'
              and exists (
                select 1
                from ciadi_ti.reception_user_polos rup
                where rup.user_id = p.id
                  and rup.polo_code = p_polo_code
                  and rup.active = true
              )
            )
          )
      )
    );
$function$;

revoke all on function ciadi_ti.has_reception_operation_access(text) from public, anon;

commit;
