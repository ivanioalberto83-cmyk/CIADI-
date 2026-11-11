-- CIADI | Leitura segura das requisições de stock por polo.
-- As operações de escrita permanecem exclusivamente nas RPCs transaccionais.

begin;

alter table ciadi_ti.stock_requisitions enable row level security;
alter table ciadi_ti.stock_requisition_lines enable row level security;

grant select on ciadi_ti.stock_requisitions, ciadi_ti.stock_requisition_lines to authenticated;

drop policy if exists ciadi_stock_requisitions_select_by_polo on ciadi_ti.stock_requisitions;
create policy ciadi_stock_requisitions_select_by_polo
  on ciadi_ti.stock_requisitions for select to authenticated
  using (ciadi_ti.has_reception_operation_access(polo_code));

drop policy if exists ciadi_stock_requisition_lines_select_by_polo on ciadi_ti.stock_requisition_lines;
create policy ciadi_stock_requisition_lines_select_by_polo
  on ciadi_ti.stock_requisition_lines for select to authenticated
  using (
    exists (
      select 1
      from ciadi_ti.stock_requisitions r
      where r.id = requisition_id
        and ciadi_ti.has_reception_operation_access(r.polo_code)
    )
  );

commit;
