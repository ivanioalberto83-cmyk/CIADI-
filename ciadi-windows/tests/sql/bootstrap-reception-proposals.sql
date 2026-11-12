-- Isolated CI fixture only. No production data or credentials.
DO $$
BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;
DO $$
BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS ciadi_ti;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$ SELECT NULL::uuid $$;

-- Composite row types required by the four Reception proposal functions.
CREATE TABLE public.finance_documentos (
  id uuid,
  document_status text,
  fiscal_status text,
  estado_pagamento text,
  total numeric,
  empresa_id uuid,
  document_no text,
  paciente_id uuid,
  cliente_id uuid,
  moeda text,
  criado_por uuid,
  data_emissao timestamptz,
  tipo_documento text
);
CREATE TABLE public.finance_pagamentos (id uuid);
CREATE TABLE public.finance_series (
  id uuid,
  tipo_documento text,
  proximo_numero bigint,
  ultimo_numero bigint,
  codigo text,
  ano integer,
  activa boolean,
  estado text,
  empresa_id uuid,
  updated_at timestamptz
);
CREATE TABLE public.finance_caixas (id uuid, empresa_id uuid, estado text);
CREATE TABLE public.finance_caixa_turnos (id uuid, caixa_id uuid, operador_id uuid, estado text);
CREATE TABLE public.finance_movimentos_caixa (
  caixa_id uuid, tipo text, valor numeric, origem text, documento_id uuid,
  pagamento_id uuid, descricao text, turno_id uuid, operador_id uuid,
  metodo_pagamento text, estado text
);
CREATE TABLE public.finance_auditoria_fiscal (
  documento_id uuid, evento text, estado_anterior text, estado_novo text,
  detalhe jsonb, utilizador_id uuid
);
CREATE TABLE public.finance_documento_linhas (
  documento_id uuid, codigo text, descricao text, quantidade numeric, unidade text,
  preco_unitario numeric, desconto numeric, taxa_imposto numeric, imposto numeric,
  total_linha numeric
);

CREATE TABLE ciadi_ti.stock_movements (
  id uuid, item_id uuid, warehouse_id uuid, movement_type text, quantity_delta numeric,
  related_movement_id uuid, reference text, notes text, unit_cost numeric,
  lot_code text, created_by uuid, idempotency_key text
);
CREATE TABLE ciadi_ti.goods_receipts (
  id uuid, warehouse_id uuid, receipt_number text, status text, notes text,
  posted_by uuid, posted_at timestamptz, updated_at timestamptz
);
CREATE TABLE ciadi_ti.goods_receipt_lines (
  id uuid, receipt_id uuid, item_id uuid, accepted_quantity numeric,
  unit_cost numeric, lot_code text, notes text, movement_id uuid
);
