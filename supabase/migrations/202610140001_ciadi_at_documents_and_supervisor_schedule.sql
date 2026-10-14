-- CIADI A.T. clinical documents: migration only; review before applying to production.
create table if not exists public.ciadi_at_documentos_clinicos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  atribuicao_id uuid not null references public.ciadi_atribuicoes_at(id) on delete restrict,
  tipo text not null check (tipo in ('anamnese','plano','checklist')),
  titulo text not null,
  data_documento date not null default current_date,
  estado text not null default 'rascunho' check (estado in ('rascunho','em_revisao','validado','arquivado')),
  dados jsonb not null default '{}'::jsonb,
  criado_por uuid not null default auth.uid() references public.perfis(id),
  revisto_por uuid references public.perfis(id),
  revisto_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ciadi_at_docs_patient_type_date_idx on public.ciadi_at_documentos_clinicos(paciente_id,tipo,data_documento desc);
alter table public.ciadi_at_documentos_clinicos enable row level security;
drop policy if exists ciadi_at_docs_read_assigned on public.ciadi_at_documentos_clinicos;
create policy ciadi_at_docs_read_assigned on public.ciadi_at_documentos_clinicos for select to authenticated using (
  ciadi_is_management() or exists (
    select 1 from public.ciadi_atribuicoes_at a
    join public.profissionais pr on (pr.id=a.profissional_id or pr.id=a.supervisor_profissional_id)
    where a.id=ciadi_at_documentos_clinicos.atribuicao_id
      and a.paciente_id=ciadi_at_documentos_clinicos.paciente_id
      and a.ativo=true and pr.perfil_id=auth.uid() and pr.ativo=true
      and coalesce((a.permissoes->>'consultar_acompanhamento')::boolean,true)=true
  )
);
drop policy if exists ciadi_at_docs_insert_assigned on public.ciadi_at_documentos_clinicos;
create policy ciadi_at_docs_insert_assigned on public.ciadi_at_documentos_clinicos for insert to authenticated with check (
  criado_por=auth.uid() and (
    ciadi_is_management() or exists (
      select 1 from public.ciadi_atribuicoes_at a
      join public.profissionais pr on (pr.id=a.profissional_id or pr.id=a.supervisor_profissional_id)
      where a.id=ciadi_at_documentos_clinicos.atribuicao_id
        and a.paciente_id=ciadi_at_documentos_clinicos.paciente_id
        and a.ativo=true and pr.perfil_id=auth.uid() and pr.ativo=true
        and coalesce((a.permissoes->>'consultar_acompanhamento')::boolean,true)=true
    )
  )
);
drop policy if exists ciadi_at_docs_update_assigned on public.ciadi_at_documentos_clinicos;
create policy ciadi_at_docs_update_assigned on public.ciadi_at_documentos_clinicos for update to authenticated using (
  ciadi_is_management() or (criado_por=auth.uid() and exists (
    select 1 from public.ciadi_atribuicoes_at a
    join public.profissionais pr on (pr.id=a.profissional_id or pr.id=a.supervisor_profissional_id)
    where a.id=ciadi_at_documentos_clinicos.atribuicao_id and a.paciente_id=ciadi_at_documentos_clinicos.paciente_id
      and a.ativo=true and pr.perfil_id=auth.uid() and pr.ativo=true
  ))
) with check (ciadi_is_management() or criado_por=auth.uid());
-- Supervisors can view/manage schedules only for the patients assigned to their supervised A.T.s.
drop policy if exists ciadi_at_atividades_supervisor_read on public.ciadi_at_atividades;
create policy ciadi_at_atividades_supervisor_read on public.ciadi_at_atividades for select to authenticated using (
  ciadi_is_management() or exists (
    select 1 from public.ciadi_atribuicoes_at a
    join public.profissionais pr on pr.id=a.supervisor_profissional_id
    where a.id=ciadi_at_atividades.atribuicao_id and a.paciente_id=ciadi_at_atividades.paciente_id
      and a.ativo=true and pr.perfil_id=auth.uid() and pr.ativo=true
  )
);
drop policy if exists ciadi_at_atividades_supervisor_insert on public.ciadi_at_atividades;
create policy ciadi_at_atividades_supervisor_insert on public.ciadi_at_atividades for insert to authenticated with check (
  criado_por=auth.uid() and exists (
    select 1 from public.ciadi_atribuicoes_at a
    join public.profissionais pr on pr.id=a.supervisor_profissional_id
    where a.id=ciadi_at_atividades.atribuicao_id and a.paciente_id=ciadi_at_atividades.paciente_id
      and a.profissional_id=ciadi_at_atividades.profissional_at_id and a.ativo=true
      and pr.perfil_id=auth.uid() and pr.ativo=true
  )
);
drop policy if exists ciadi_at_atividades_supervisor_update on public.ciadi_at_atividades;
create policy ciadi_at_atividades_supervisor_update on public.ciadi_at_atividades for update to authenticated using (
  ciadi_is_management() or exists (
    select 1 from public.ciadi_atribuicoes_at a
    join public.profissionais pr on pr.id=a.supervisor_profissional_id
    where a.id=ciadi_at_atividades.atribuicao_id and a.paciente_id=ciadi_at_atividades.paciente_id
      and a.ativo=true and pr.perfil_id=auth.uid() and pr.ativo=true
  )
) with check (ciadi_is_management() or criado_por=auth.uid());

drop policy if exists ciadi_at_atividades_management_insert on public.ciadi_at_atividades;
create policy ciadi_at_atividades_management_insert on public.ciadi_at_atividades for insert to authenticated with check (ciadi_is_management() and criado_por=auth.uid());
