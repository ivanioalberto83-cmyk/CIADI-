export const DOCUMENT_BUCKET = "ciadi-ti-documentos";
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function isPdf(bytes: Uint8Array): boolean {
  if (bytes.length < 10 || bytes.length > MAX_PDF_BYTES) return false;
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  const tail = new TextDecoder().decode(bytes.slice(Math.max(0, bytes.length - 1024)));
  return header === "%PDF-" && tail.includes("%%EOF");
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const stableBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(stableBuffer).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", stableBuffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createVerificationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Cache-Control": "no-store, max-age=0",
    "Pragma": "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
}


function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] as string);
}

export function renderVerificationPage(input: {
  valid: boolean;
  documentNumber?: string;
  documentType?: string;
  issuedAt?: string;
}): string {
  const details = input.valid
    ? `<dl>
        <div><dt>Número do documento</dt><dd>${escapeHtml(input.documentNumber)}</dd></div>
        <div><dt>Tipo documental</dt><dd>${escapeHtml(input.documentType)}</dd></div>
        <div><dt>Data de emissão</dt><dd>${escapeHtml(input.issuedAt)}</dd></div>
      </dl>`
    : "<p>Não foi possível confirmar a autenticidade deste documento. Verifique o QR Code ou contacte o CIADI.</p>";
  const heading = input.valid ? "Documento autêntico" : "Documento não verificado";
  const status = input.valid ? "VALIDADO" : "NÃO VALIDADO";
  const color = input.valid ? "#18794e" : "#b42318";
  return `<!doctype html>
<html lang="pt-AO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${heading} | CIADI</title>
<style>
:root{color-scheme:light;font-family:Arial,Helvetica,sans-serif;color:#6f351f;background:#fbfdff}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
main{width:min(100%,560px);background:#fff;border:1px solid #ffe7bf;border-radius:22px;padding:30px;box-shadow:0 12px 36px rgba(111,53,31,.09)}
.brand{display:flex;align-items:center;gap:12px;border-bottom:3px solid #f58200;padding-bottom:18px}
.logo{display:grid;place-items:center;width:54px;height:54px;border-radius:15px;background:#f58200;color:#fff;font-size:22px;font-weight:900}
.brand strong{display:block;color:#f58200;font-size:23px;letter-spacing:.04em}
.brand span{display:block;font-size:10px;line-height:1.5;font-weight:700}
.status{display:inline-block;margin:24px 0 10px;padding:7px 11px;border-radius:999px;background:${input.valid ? "#e8f5ee" : "#fef0ef"};color:${color};font-size:11px;font-weight:900;letter-spacing:.08em}
h1{font-size:25px;margin:4px 0 10px;color:#6f351f}
p{line-height:1.6;color:#624c43}
dl{margin:22px 0 0;border-top:1px solid #f0e5dd}
dl div{padding:13px 0;border-bottom:1px solid #f0e5dd}
dt{font-size:11px;color:#8a7166;margin-bottom:5px}
dd{margin:0;font-weight:700;overflow-wrap:anywhere}
footer{margin-top:24px;padding-top:14px;border-top:1px solid #f0e5dd;color:#8a7166;font-size:11px;line-height:1.5}
</style>
</head>
<body>
<main>
<header class="brand"><div class="logo" aria-hidden="true">CI</div><div><strong>CIADI</strong><span>CENTRO INTEGRADO DE APOIO E DESENVOLVIMENTO INDIVIDUAL</span></div></header>
<span class="status">${status}</span>
<h1>${heading}</h1>
${details}
<footer>Verificação electrónica do documento. Esta página apresenta apenas os dados necessários para confirmar a emissão pelo CIADI.</footer>
</main>
</body>
</html>`;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" },
  });
}
