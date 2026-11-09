import { withSupabase } from "@supabase/server";
import {
  TOKEN_RE,
  UUID_RE,
  constantTimeEqual,
  corsHeaders,
  jsonResponse,
  renderVerificationPage,
  sha256Hex,
} from "../_shared/document.ts";

function verificationResponse(
  req: Request,
  result: { valid: boolean; documentNumber?: string; documentType?: string; issuedAt?: string },
): Response {
  if ((req.headers.get("accept") || "").toLowerCase().includes("text/html")) {
    return new Response(renderVerificationPage(result), {
      status: result.valid ? 200 : 404,
      headers: {
        ...corsHeaders(),
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        "X-Frame-Options": "DENY",
      },
    });
  }
  return jsonResponse(result.valid
    ? {
      valid: true,
      status: "valid",
      issuer: "CIADI",
      document_number: result.documentNumber,
      document_type: result.documentType,
      issued_at: result.issuedAt,
    }
    : { valid: false, status: "not_verified" }, result.valid ? 200 : 404);
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
    if (req.method !== "GET") return jsonResponse({ valid: false, status: "not_verified" }, 405);

    const url = new URL(req.url);
    const documentId = url.searchParams.get("document_id") || "";
    const token = url.searchParams.get("token") || "";
    if (!UUID_RE.test(documentId) || !TOKEN_RE.test(token)) {
      return verificationResponse(req, { valid: false });
    }

    const tokenHash = await sha256Hex(new TextEncoder().encode(token));
    const { data: document, error } = await ctx.supabaseAdmin
      .schema("ciadi_ti").from("documents")
      .select("document_number,document_type_code,issued_at,status,verification_token_hash")
      .eq("id", documentId)
      .eq("status", "issued")
      .maybeSingle();

    if (error || !document || !constantTimeEqual(document.verification_token_hash || "", tokenHash)) {
      return verificationResponse(req, { valid: false });
    }

    // Never expose the token, hash, payload, storage path, PDF, actor, or personal data.
    return verificationResponse(req, {
      valid: true,
      documentNumber: document.document_number,
      documentType: document.document_type_code,
      issuedAt: document.issued_at,
    });
  }),
};
