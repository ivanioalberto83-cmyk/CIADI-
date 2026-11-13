'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('contador interno da fila tem RLS e não concede acesso directo a clientes', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../supabase/proposals/ciadi-reception-security-hardening-proposal.sql'),
    'utf8'
  );
  assert.match(sql, /alter table ciadi_reception\.front_desk_queue_counters\s+enable row level security/i);
  assert.match(sql, /revoke all on table ciadi_reception\.front_desk_queue_counters\s+from public, anon, authenticated/i);
  assert.match(sql, /reception_register_arrival\(text,uuid,uuid,text,text,text,uuid\)/i);
  assert.match(sql, /prosecdef = true/i);
  assert.match(sql, /PROPOSTA APENAS/i);
});

test('RPC antiga de pagamentos é revogada antes de expor o novo contrato autenticado', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../supabase/proposals/ciadi-reception-payment-cashbox-hardening-proposal.sql'),
    'utf8'
  );
  assert.match(sql, /revoke all on function public\.finance_registar_pagamento\(uuid,numeric,text,text,uuid,text\) from public, anon, authenticated/i);
  assert.match(sql, /revoke all on function public\.finance_registar_pagamento\(uuid,numeric,text,text,text,uuid,text\) from public, anon, authenticated/i);
  assert.match(sql, /revoke all on function public\.finance_registar_pagamento\(uuid, numeric, text, text, text, text, uuid, text\)\s+from public, anon/i);
  assert.match(sql, /grant execute on function public\.finance_registar_pagamento\(uuid, numeric, text, text, text, text, uuid, text\)\s+to authenticated/i);
});
