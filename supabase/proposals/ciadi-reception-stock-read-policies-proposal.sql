-- CIADI | Leitura segura das requisições de stock por polo.
-- As operações de escrita permanecem exclusivamente nas RPCs transaccionais.

begin;

alter table ciadi_ti.items enable row level security;
alter table ciadi_ti.warehouses enable row level security;
alter table ciadi_ti.stock_movements enable row level security;
alter table ciadi_ti.inventory_counts enable row level security;
alter table ciadi_ti.inventory_count_lines enable row level security;
alter table ciadi_ti.stock_requisitions enable row level security;
alter table ciadi_ti.stock_requisition_lines enable row level security;

grant select on ciadi_ti.stock_requisitions, ciadi_ti.stock_requisition_lines to authenticated;

grant select on ciadi_ti.items, ciadi_ti.warehouses,
  ciadi_ti.stock_movements, ciadi_ti.inventory_counts,
  ciadi_ti.inventory_count_lines, ciadi_ti.stock_balances
  to authenticated;
grant select on public.finance_centros_custo to authenticated;

drop policy if exists ciadi_items_select_support_or_reception on ciadi_ti.items;
create policy ciadi_items_select_support_or_reception
  on ciadi_ti.items for select to authenticated
  using (
    ciadi_ti.has_support_access()
    or ciadi_ti.has_reception_operation_access('talatona')
    or ciadi_ti.has_reception_operation_access('jardim_de_rosas')
  );

drop policy if exists ciadi_warehouses_select_by_polo on ciadi_ti.warehouses;
create policy ciadi_warehouses_select_by_polo
  on ciadi_ti.warehouses for select to authenticated
  using (ciadi_ti.has_reception_warehouse_access(id));

drop policy if exists ciadi_stock_movements_select_by_warehouse on ciadi_ti.stock_movements;
create policy ciadi_stock_movements_select_by_warehouse
  on ciadi_ti.stock_movements for select to authenticated
  using (ciadi_ti.has_reception_warehouse_access(warehouse_id));

drop policy if exists ciadi_inventory_counts_select_by_warehouse on ciadi_ti.inventory_counts;
create policy ciadi_inventory_counts_select_by_warehouse
  on ciadi_ti.inventory_counts for select to authenticated
  using (ciadi_ti.has_reception_warehouse_access(warehouse_id));

drop policy if exists ciadi_inventory_count_lines_select_by_warehouse on ciadi_ti.inventory_count_lines;
create policy ciadi_inventory_count_lines_select_by_warehouse
  on ciadi_ti.inventory_count_lines for select to authenticated
  using (
    exists (
      select 1 from ciadi_ti.inventory_counts c
      where c.id = count_id
        and ciadi_ti.has_reception_warehouse_access(c.warehouse_id)
    )
  );

drop policy if exists ciadi_finance_centros_custo_select_by_polo on public.finance_centros_custo;
create policy ciadi_finance_centros_custo_select_by_polo
  on public.finance_centros_custo for select to authenticated
  using (
    ciadi_ti.has_support_access()
    or (codigo='CC-001' and ciadi_ti.has_reception_operation_access('talatona'))
    or (codigo='CC-002' and ciadi_ti.has_reception_operation_access('jardim_de_rosas'))
  );

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
