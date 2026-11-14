-- Behavioural SQL homologation for the Reception attendance proposal.
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000099', true);

insert into public.pacientes (id, nome_completo, nome_responsavel, codigo_paciente)
values ('00000000-0000-4000-8000-000000000001', 'Utente Teste', 'Responsável Teste', 'UT-TEST-001');

insert into public.agendamentos (id,paciente_id,data_hora,estado,checkin_em,polo_code) values
('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001',now()+interval '60 minutes','confirmada',null,'jardim_de_rosas'),
('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000001',now()-interval '10 minutes','agendada',null,'talatona'),
('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000001',now()-interval '25 minutes','confirmada',null,'jardim_de_rosas'),
('00000000-0000-4000-8000-000000000014','00000000-0000-4000-8000-000000000001',now()-interval '60 minutes','em_atendimento',now()-interval '10 minutes','talatona'),
('00000000-0000-4000-8000-000000000015','00000000-0000-4000-8000-000000000001',now()-interval '2 hours','faltou',null,null),
('00000000-0000-4000-8000-000000000016','00000000-0000-4000-8000-000000000001',now()-interval '2 hours','em_atendimento',null,'talatona'),
('00000000-0000-4000-8000-000000000017','00000000-0000-4000-8000-000000000001',now()-interval '2 hours','cancelada',null,'talatona'),
('00000000-0000-4000-8000-000000000018','00000000-0000-4000-8000-000000000001',now()-interval '2 hours','reagendada',null,'jardim_de_rosas');

do $attendance_test$
declare
  v_today date := timezone('Africa/Luanda', now())::date;
  v_metrics jsonb;
  v_summary jsonb;
  v_null_polo jsonb;
  v_search jsonb;
begin
  if to_regprocedure('ciadi_reception.reception_get_attendance_metrics(date,date,text)') is null then
    raise exception 'Attendance metrics RPC was not created.';
  end if;
  if to_regprocedure('ciadi_reception.reception_search_appointments(text,date,date,text)') is null then
    raise exception 'Polo-aware appointment search RPC signature is missing.';
  end if;

  v_metrics := ciadi_reception.reception_get_attendance_metrics(v_today - 1, v_today + 1, null);
  v_summary := v_metrics->'summary';

  if (v_summary->>'scheduled')::integer <> 6 then
    raise exception 'Expected 6 eligible appointments, received %.', v_summary->>'scheduled';
  end if;
  if (v_summary->>'upcoming')::integer <> 1 then
    raise exception 'Future appointments must be separate from grace-period appointments.';
  end if;
  if (v_summary->>'within_tolerance')::integer <> 1 then
    raise exception 'Expected one appointment within the 20-minute tolerance.';
  end if;
  if (v_summary->>'possible_no_show')::integer <> 1 then
    raise exception 'Expected one possible absence after the 20-minute tolerance.';
  end if;
  if (v_summary->>'late')::integer <> 1 or (v_summary->>'late_minutes_total')::integer <> 50 then
    raise exception 'Late arrival must count 50 minutes from the scheduled time.';
  end if;
  if (v_summary->>'confirmed_no_show')::integer <> 1 then
    raise exception 'Confirmed absences must remain separate from possible absences.';
  end if;
  if (v_summary->>'inconsistent_data')::integer <> 1 then
    raise exception 'Missing check-in timestamp on an attended status must be flagged as inconsistent.';
  end if;
  if (v_summary->>'excluded')::integer <> 2 then
    raise exception 'Cancelled and rescheduled appointments must be excluded.';
  end if;

  select item into v_null_polo
  from jsonb_array_elements(v_metrics->'by_polo') item
  where item->>'polo_label' = 'Polo não definido';
  if v_null_polo is null or (v_null_polo->>'confirmed_no_show')::integer <> 1 then
    raise exception 'Appointments without polo must remain in the unassigned bucket.';
  end if;

  v_search := ciadi_reception.reception_search_appointments(
    'Utente Teste', v_today - 1, v_today + 1, 'talatona'
  );
  if jsonb_array_length(v_search) <> 1 then
    raise exception 'Polo-aware appointment search returned an unexpected number of records.';
  end if;

  if v_metrics::text like '%patient_name%' or v_metrics::text like '%Responsável Teste%' then
    raise exception 'Aggregate attendance metrics must not expose personal data.';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'ciadi_reception.front_desk_visits'::regclass) then
    raise exception 'Front-desk visits must have RLS enabled.';
  end if;
  if has_function_privilege('authenticated',
       'ciadi_reception.reception_get_attendance_metrics(date,date,text)', 'EXECUTE') then
    raise exception 'Authenticated must not receive execute before the permission phase.';
  end if;
  if has_table_privilege('authenticated', 'ciadi_reception.front_desk_visits', 'SELECT') then
    raise exception 'Authenticated must not receive table access before the permission phase.';
  end if;
end;
$attendance_test$;

rollback;
