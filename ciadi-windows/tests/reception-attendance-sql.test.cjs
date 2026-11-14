const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const proposalPath = path.join(__dirname, '../../supabase/proposals/ciadi-reception-workflow-proposal.sql');
const sql = fs.readFileSync(proposalPath, 'utf8');

test('attendance metrics proposal calculates delay and possible absence with server time', () => {
  assert.match(sql, /function ciadi_reception\.reception_get_attendance_metrics\s*\(/i);
  assert.match(sql, /v_server_now\s+timestamptz\s*:=\s*now\(\)/i);
  assert.match(sql, /interval\s+'20 minutes'/i);
  assert.match(sql, /possible_no_show/i);
  assert.match(sql, /late_minutes_total/i);
});

test('attendance metrics proposal is read-only, authenticated and has no remote grants', () => {
  const start = sql.toLowerCase().indexOf('function ciadi_reception.reception_get_attendance_metrics');
  assert.notEqual(start, -1);
  const end = sql.indexOf('$attendance$;', start);
  assert.notEqual(end, -1);
  const body = sql.slice(start, end + 3).toLowerCase();
  assert.match(body, /security invoker/);
  assert.match(body, /auth\.uid\(\) is null/);
  assert.doesNotMatch(body, /\b(insert into|update\s+public\.agendamentos|delete from)\b/);
  assert.match(sql, /revoke execute on all functions in schema ciadi_reception from public, anon, authenticated/i);
});

test('appointment search SQL accepts the polo argument used by the Reception repository', () => {
  const start = sql.toLowerCase().indexOf('function ciadi_reception.reception_search_appointments');
  assert.notEqual(start, -1);
  const end = sql.indexOf('$$;', start);
  assert.notEqual(end, -1);
  const body = sql.slice(start, end + 3);
  assert.match(body, /p_polo_code\\s+text\\s+default\\s+null/i);
  assert.match(body, /a\\.polo_code\\s*=\\s*p_polo_code/i);
});
