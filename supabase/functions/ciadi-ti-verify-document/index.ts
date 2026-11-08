import { withSupabase } from "@supabase/server";
import {
  TOKEN_RE,
  UUID_RE,
  constantTimeEqual,
  corsHeaders,
  jsonResponse,
  sha256Hex,
} from "../_shared/document.ts";

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
    if (req.method !== "GET") return jsonResponse({ valid: false, status: "not_verified" }, 405);

    const url = new URL(req.url);
    const documentId = url.searchParams.get("document_id") || "";
    const token = url.searchParams.get("token") || "";
    if (!UUID_RE.test(documentId) || !TOKEN_RE.test(token)) {
      return jsonResponse({ valid: false, status: "not_verified" }, 404);
    }

    const tokenHash = await sha256Hex(new TextEncoder().encode(token));
    const { data: document, error } = await ctx.supabaseAdmin
      .from("documents")
      .select("document_number,document_type_code,issued_at,status,verification_token_hash")
      .eq("id", documentId)
      .eq("status", "issued")
      .maybeSingle();

    if (error || !document || !constantTimeEqual(document.verification_token_hash || "", tokenHash)) {
      return jsonResponse({ valid: false, status: "not_verified" }, 404);
    }

    // Do not return the stored hash, payload, storage path, PDF, actor, or personal data.
    return jsonResponse({
      valid: true,
      status: "valid",
      issuer: "CIADI",
      document_number: document.document_number,
      document_type: document.document_type_code,
      issued_at: document.issued_at,
    });
  }),
};
