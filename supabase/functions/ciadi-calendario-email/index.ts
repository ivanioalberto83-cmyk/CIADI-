import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-ciadi-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, message: 'Método não permitido.' }, 405);

  const cronSecret = req.headers.get('x-ciadi-cron-secret') || '';
  if (cronSecret.length < 32) return json({ success: false, message: 'Autenticação de automação obrigatória.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM');
  if (!supabaseUrl || !serviceKey) return json({ success: false, message: 'Configuração Supabase incompleta.' }, 500);
  if (!resendKey || !from) return json({ success: false, message: 'RESEND_API_KEY e/ou RESEND_FROM não configurados. Nenhum email foi enviado.' }, 503);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: valid, error: authError } = await admin.rpc('ciadi_validar_token_calendario', { p_token: cronSecret });
  if (authError || valid !== true) return json({ success: false, message: 'Token de automação inválido.' }, 401);

  const { data: jobs, error: readError } = await admin
    .from('ciadi_email_notificacoes_fila')
    .select('id,notification_id,recipient_email,recipient_name,subject,html,tentativas')
    .eq('estado', 'pendente')
    .order('created_at', { ascending: true })
    .limit(50);
  if (readError) return json({ success: false, message: 'Não foi possível ler a fila de emails.' }, 500);

  let sent = 0, failed = 0, skipped = 0;
  const errors: string[] = [];
  for (const job of jobs || []) {
    const { data: claimed, error: claimError } = await admin
      .from('ciadi_email_notificacoes_fila')
      .update({ estado: 'enviando', tentativas: Number(job.tentativas || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', job.id).eq('estado', 'pendente')
      .select('id').maybeSingle();
    if (claimError || !claimed) { skipped++; continue; }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + resendKey,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'ciadi-calendar-' + job.id,
        },
        body: JSON.stringify({
          from,
          to: [job.recipient_email],
          subject: job.subject,
          html: job.html,
          ...(job.recipient_name ? { tags: [{ name: 'recipient_type', value: 'ciadi_internal' }] } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload?.message || payload?.error || 'Resend respondeu HTTP ' + response.status));
      await admin.from('ciadi_email_notificacoes_fila').update({
        estado: 'enviado', provider_id: payload?.id || null, enviado_em: new Date().toISOString(),
        erro: null, updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro de envio desconhecido';
      await admin.from('ciadi_email_notificacoes_fila').update({
        estado: 'falhou', erro: message.slice(0, 1000), updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      failed++; errors.push(job.id + ': ' + message);
    }
  }
  return json({ success: failed === 0, scanned: (jobs || []).length, sent, failed, skipped, errors: errors.slice(0, 5) });
});