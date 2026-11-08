import { withSupabase } from "@supabase/server";
import QRCode from "qrcode";
import {
  UUID_RE,
  corsHeaders,
  createVerificationToken,
  jsonResponse,
  sha256Hex,
} from "../_shared/document.ts";

const SUPPORT_ROLES = new Set(["admin", "gestor", "suporte_informatica"]);

function svgDataUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return "data:image/svg+xml;base64," + btoa(binary);
}

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  const actorId = ctx.userClaims?.id;
  if (typeof actorId !== "string" || !UUID_RE.test(actorId)) {
    return jsonResponse({ error: "Sessão autenticada inválida." }, 401);
  }

  let body: { document_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Pedido JSON inválido." }, 400);
  }
  const documentId = String(body.document_id || "");
  if (!UUID_RE.test(documentId)) return jsonResponse({ error: "Identificador documental inválido." }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl || !/^https:\/\//i.test(supabaseUrl)) {
    return jsonResponse({ error: "Configuração do serviço documental incompleta." }, 503);
  }

  const { data: profile, error: profileError } = await ctx.supabaseAdmin
    .from("perfis")
    .select("id,tipo,ativo")
    .eq("id", actorId)
    .maybeSingle();
  if (profileError || !profile || profile.ativo !== true || !SUPPORT_ROLES.has(profile.tipo)) {
    return jsonResponse({ error: "Perfil activo sem acesso ao Suporte Informático." }, 403);
  }

  const db = ctx.supabaseAdmin.schema("ciadi_ti");
  const { data: document, error: documentError } = await db
    .from("documents")
    .select("id,status")
    .eq("id", documentId)
    .maybeSingle();
  if (documentError || !document) return jsonResponse({ error: "Documento não encontrado." }, 404);
  if (document.status !== "draft") return jsonResponse({ error: "Só é possível preparar um rascunho." }, 409);

  const token = createVerificationToken();
  const tokenHash = await sha256Hex(new TextEncoder().encode(token));
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
  const { data: documentNumber, error: prepareError } = await db.rpc("prepare_document_issuance", {
    p_document_id: documentId,
    p_actor_id: actorId,
    p_verification_token_hash: tokenHash,
  });
  if (prepareError || typeof documentNumber !== "string" || !documentNumber) {
    console.error("CIADI TI issuance preparation failed:", prepareError?.message || "invalid RPC result");
    return jsonResponse({ error: "Não foi possível reservar o número e preparar a emissão documental." }, 500);
  }

  const verificationUrl = new URL("/functions/v1/ciadi-ti-verify-document", supabaseUrl);
  verificationUrl.searchParams.set("document_id", documentId);
  verificationUrl.searchParams.set("token", token);

  let qrSvg: string;
  try {
    qrSvg = await QRCode.toString(verificationUrl.toString(), {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256,
    });
  } catch (error) {
    console.error("CIADI TI QR rendering failed:", error instanceof Error ? error.message : "unknown error");
    return jsonResponse({ error: "Não foi possível gerar o QR Code." }, 500);
  }

  return jsonResponse({
    ok: true,
    documentId,
    verificationUrl: verificationUrl.toString(),
    qrDataUrl: svgDataUrl(qrSvg),
    expiresAt: expiresAt.toISOString(),
  });
});

export default {
  fetch: (req: Request) => req.method === "OPTIONS"
    ? new Response("ok", { headers: corsHeaders() })
    : handler(req),
};
