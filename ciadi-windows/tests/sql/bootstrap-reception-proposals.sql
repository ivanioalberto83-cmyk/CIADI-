-- Isolated CI fixture only. No production data or credentials.
DO $$
BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;
DO $role_authenticated$
BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$role_authenticated$;
DO $role_service$
BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$role_service$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS ciadi_ti;
CREATE SCHEMA IF NOT EXISTS ciadi_reception;

-- Queue counter is internal: only the owner SECURITY DEFINER arrival RPC uses it.
CREATE TABLE ciadi_reception.front_desk_queue_counters (
  polo_code text NOT NULL,
  service_day date NOT NULL,
  last_ticket_number integer NOT NULL CHECK (last_ticket_number > 0),
  PRIMARY KEY (polo_code, service_day)
);

-- SECURITY DEFINER stub matching the remote owner/contract for isolated privilege tests.
CREATE OR REPLACE FUNCTION ciadi_reception.reception_register_arrival(
  text, uuid, uuid, text, text, text, uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ciadi_reception
AS $stub$ SELECT '{}'::jsonb $stub$;

-- Minimal polo/procurement fixtures required by the scoped workspace triggers.
CREATE TABLE ciadi_ti.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number bigint NOT NULL DEFAULT 1,
  supplier_id uuid,
  status text NOT NULL DEFAULT 'draft',
  justification text NOT NULL DEFAULT '',
  estimated_total numeric,
  polo_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ciadi_ti.stock_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polo_code text NOT NULL,
  warehouse_id uuid NOT NULL,
  cost_center_id uuid NOT NULL,
  purpose text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'draft',
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.finance_centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  empresa_id uuid
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $auth_uid$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$auth_uid$;

-- Simula a RPC antiga e os grants remotos para provar que a proposta os revoga.
CREATE OR REPLACE FUNCTION public.finance_registar_pagamento(
  uuid, numeric, text, text, uuid, text
)
RETURNS TABLE(pagamento_id uuid, recibo_id uuid, recibo_no text, estado_pagamento text)
LANGUAGE sql AS $legacy_payment6$
  SELECT null::uuid, null::uuid, null::text, null::text
$legacy_payment6$;
GRANT EXECUTE ON FUNCTION public.finance_registar_pagamento(uuid,numeric,text,text,uuid,text)
  TO anon, authenticated, service_role;

-- Simula a assinatura intermédia de sete argumentos para garantir revogação na migração.
CREATE OR REPLACE FUNCTION public.finance_registar_pagamento(
  uuid, numeric, text, text, text, uuid, text
)
RETURNS TABLE(pagamento_id uuid, recibo_id uuid, recibo_no text, estado_pagamento text)
LANGUAGE sql AS $legacy_payment7$
  SELECT null::uuid, null::uuid, null::text, null::text
$legacy_payment7$;
GRANT EXECUTE ON FUNCTION public.finance_registar_pagamento(uuid,numeric,text,text,text,uuid,text)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ciadi_finance_can(p_capability text)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT p_capability = ANY(string_to_array(current_setting('ciadi.test_finance_caps', true), ',')) $$;
CREATE OR REPLACE FUNCTION public.ciadi_finance_operator_id()
RETURNS uuid LANGUAGE sql STABLE AS $operator_id$ SELECT nullif(current_setting('ciadi.test_operator_id', true), '')::uuid $operator_id$;
CREATE OR REPLACE FUNCTION public.ciadi_finance_is_staff()
RETURNS boolean LANGUAGE sql STABLE AS $finance_staff$ SELECT false $finance_staff$;
CREATE TABLE public.perfis (
  id uuid PRIMARY KEY,
  ativo boolean NOT NULL DEFAULT true,
  tipo text NOT NULL DEFAULT 'operador'
);
CREATE OR REPLACE FUNCTION public.finance_recalcular_documento(p_documento_id uuid)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;

CREATE OR REPLACE FUNCTION ciadi_ti.has_reception_operation_access(p_polo_code text)
RETURNS boolean LANGUAGE sql STABLE AS $reception_access$
  SELECT p_polo_code = ANY(string_to_array(current_setting('ciadi.test_allowed_polo', true), ','))
$reception_access$;
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
CREATE TABLE public.finance_caixas (
  id uuid PRIMARY KEY, empresa_id uuid, estado text, polo_code text,
  nome text, codigo text, saldo_abertura numeric, saldo_fechamento numeric,
  saldo_atual numeric, aberto_em timestamptz, fechado_em timestamptz,
  aberto_por uuid, fechado_por uuid, updated_at timestamptz
);
CREATE TABLE public.finance_caixa_turnos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), caixa_id uuid, operador_id uuid,
  estado text, saldo_inicial numeric, aberto_em timestamptz DEFAULT now(),
  fechado_em timestamptz, saldo_esperado numeric, saldo_contado numeric,
  diferenca numeric, justificacao_diferenca text
);
CREATE TABLE public.finance_movimentos_caixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_id uuid, tipo text, valor numeric, origem text, documento_id uuid,
  pagamento_id uuid, descricao text, turno_id uuid, operador_id uuid,
  metodo_pagamento text, estado text, data_movimento timestamptz,
  criado_por uuid, categoria text
);
CREATE TABLE public.finance_operadores (id uuid PRIMARY KEY, funcao text);
CREATE TABLE public.finance_auditoria_operacoes (
  operador_id uuid, caixa_id uuid, turno_id uuid, movimento_id uuid,
  evento text, detalhe jsonb
);
CREATE OR REPLACE FUNCTION public.ciadi_tesouraria_saldo_turno(p_turno_id uuid)
RETURNS numeric LANGUAGE sql STABLE AS $turn_cash_total$ SELECT null::numeric $turn_cash_total$;
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
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE OR REPLACE FUNCTION extensions.digest(data text, type text)
RETURNS bytea LANGUAGE sql IMMUTABLE AS $$
  SELECT public.digest(data, type)
$$;
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
  ADD COLUMN IF NOT EXISTS empresa_id uuid,
  ADD COLUMN IF NOT EXISTS idempotency_key text;
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
  ADD COLUMN IF NOT EXISTS moeda text,
  ADD COLUMN IF NOT EXISTS polo_code text;
ALTER TABLE public.finance_caixas ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.finance_caixa_turnos
  ADD COLUMN IF NOT EXISTS aberto_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS saldo_inicial numeric NOT NULL DEFAULT 0;
ALTER TABLE public.finance_caixa_turnos ALTER COLUMN id SET DEFAULT gen_random_uuid();
