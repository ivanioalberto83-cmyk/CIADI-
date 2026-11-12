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
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION public.ciadi_finance_can(p_capability text)
RETURNS boolean LANGUAGE sql STABLE AS $ SELECT p_capability = ANY(string_to_array(current_setting('ciadi.test_finance_caps', true), ',')) $;
CREATE OR REPLACE FUNCTION public.ciadi_finance_operator_id()
RETURNS uuid LANGUAGE sql STABLE AS $ SELECT nullif(current_setting('ciadi.test_operator_id', true), '')::uuid $;
CREATE OR REPLACE FUNCTION public.finance_recalcular_documento(p_documento_id uuid)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;

CREATE OR REPLACE FUNCTION ciadi_ti.has_reception_operation_access(p_polo_code text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_polo_code = current_setting('ciadi.test_allowed_polo', true)
$$;
CREATE OR REPLACE FUNCTION ciadi_ti.has_finance_approval()
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;

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


-- Minimal operational stock fixture for transactional tests.
CREATE TABLE ciadi_ti.items (
  id uuid PRIMARY KEY,
  sku text NOT NULL,
  name text NOT NULL,
  unit_of_measure text NOT NULL DEFAULT 'UN',
  minimum_stock numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE ciadi_ti.warehouses (
  id uuid PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  polo text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
ALTER TABLE ciadi_ti.stock_movements
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ciadi_ti.stock_movements
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE ciadi_ti.stock_movements
  ADD CONSTRAINT stock_movements_idempotency_key_unique UNIQUE (idempotency_key);
CREATE TABLE ciadi_ti.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ciadi_ti.goods_receipts
  ADD COLUMN IF NOT EXISTS purchase_request_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ciadi_ti.goods_receipt_lines
  ADD COLUMN IF NOT EXISTS received_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returned_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_request_line_id uuid;
ALTER TABLE ciadi_ti.goods_receipts
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE ciadi_ti.goods_receipt_lines
  ALTER COLUMN id SET DEFAULT gen_random_uuid();


-- Additional synthetic finance columns for successful and rejected payment transactions.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE OR REPLACE FUNCTION extensions.digest(data text, type text)
RETURNS bytea LANGUAGE sql IMMUTABLE AS $
  SELECT public.digest(data, type)
$;
ALTER TABLE public.finance_documentos
  ADD COLUMN IF NOT EXISTS serie_id uuid,
  ADD COLUMN IF NOT EXISTS numero_sequencial bigint,
  ADD COLUMN IF NOT EXISTS documento_origem_id uuid,
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS desconto numeric,
  ADD COLUMN IF NOT EXISTS imposto numeric,
  ADD COLUMN IF NOT EXISTS retencao numeric,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS data_operacao date,
  ADD COLUMN IF NOT EXISTS documento_serie text,
  ADD COLUMN IF NOT EXISTS origem_tipo text,
  ADD COLUMN IF NOT EXISTS hash_documento text,
  ADD COLUMN IF NOT EXISTS hash_algoritmo text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.finance_documentos ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.finance_pagamentos
  ADD COLUMN IF NOT EXISTS documento_id uuid,
  ADD COLUMN IF NOT EXISTS valor numeric,
  ADD COLUMN IF NOT EXISTS metodo text,
  ADD COLUMN IF NOT EXISTS referencia text,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS recebido_por uuid,
  ADD COLUMN IF NOT EXISTS empresa_id uuid;
ALTER TABLE public.finance_pagamentos ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.finance_series
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS ano integer,
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.finance_series ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.finance_caixas
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS localizacao text,
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS moeda text;
ALTER TABLE public.finance_caixas ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.finance_caixa_turnos
  ADD COLUMN IF NOT EXISTS aberto_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS saldo_inicial numeric NOT NULL DEFAULT 0;
ALTER TABLE public.finance_caixa_turnos ALTER COLUMN id SET DEFAULT gen_random_uuid();
