import { withSupabase } from "@supabase/server";
import {
  DOCUMENT_BUCKET,
  MAX_PDF_BYTES,
  TOKEN_RE,
  UUID_RE,
  constantTimeEqual,
  corsHeaders,
  isPdf,
  jsonResponse,
  sha256Hex,
} from "../_shared/document.ts";

const SUPPORT_ROLES = new Set(["admin", "gestor", "suporte_informatica"]);

function verificationUrl(supabaseUrl: string, documentId: string, token: string): string {
  const url = new URL("/functions/v1/ciadi-ti-verify-document", supabaseUrl);
  url.searchParams.set("document_id", documentId);
  url.searchParams.set("token", token);
  return url.toString();
}

function issuedResponse(documentId: string, document: Record<string, unknown>, url: string, idempotent = false): Response {
  return jsonResponse({
    ok: true,
    idempotent,
    document: {
      id: documentId,
      number: document.document_number,
      type: document.document_type_code,
      title: document.title,
      status: "issued",
      issued_at: document.issued_at,
    },
    verificationUrl: url,
  });
}

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  const actorId = ctx.userClaims?.id;
  if (typeof actorId !== "string" || !UUID_RE.test(actorId)) {
    return jsonResponse({ error: "Sessão autenticada inválida." }, 401);
  }

  const declaredLength = Number(req.headers.get("content-length") || "0");
  if (declaredLength > MAX_PDF_BYTES + 128 * 1024) {
    return jsonResponse({ error: "O PDF excede o limite de 10 MiB." }, 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonResponse({ error: "Pedido multipart/form-data inválido." }, 400);
  }

  const documentId = String(form.get("document_id") || "");
  const verificationToken = String(form.get("verification_token") || "");
  const upload = form.get("file");
  if (!UUID_RE.test(documentId) || !TOKEN_RE.test(verificationToken) || !(upload instanceof File)) {
    return jsonResponse({ error: "Identificador, token de emissão ou PDF em falta." }, 400);
  }
  if (upload.size < 1 || upload.size > MAX_PDF_BYTES || upload.type !== "application/pdf") {
    return jsonResponse({ error: "O ficheiro deve ser PDF e ter entre 1 byte e 10 MiB." }, 415);
  }

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

  const tokenHash = await sha256Hex(new TextEncoder().encode(verificationToken));
  const url = verificationUrl(supabaseUrl, documentId, verificationToken);
  const db = ctx.supabaseAdmin.schema("ciadi_ti");
  const { data: document, error: documentError } = await db
    .from("documents")
    .select("id,document_type_code,title,status,document_number,verification_token_hash,issued_at")
    .eq("id", documentId)
    .maybeSingle();
  if (documentError || !document) return jsonResponse({ error: "Documento não encontrado." }, 404);

  // A lost HTTP response after a committed RPC must not delete the official PDF.
  // Repeating the same request with the same token returns the committed result.
  if (document.status === "issued") {
    if (constantTimeEqual(String(document.verification_token_hash || ""), tokenHash)) {
      return issuedResponse(documentId, document, url, true);
    }
    return jsonResponse({ error: "O documento já foi emitido com outra sessão." }, 409);
  }
  if (document.status !== "draft") return jsonResponse({ error: "Só é possível emitir um rascunho." }, 409);

  const { data: issuanceSession, error: sessionError } = await db
    .from("document_issuance_sessions")
    .select("id")
    .eq("document_id", documentId)
    .eq("actor_id", actorId)
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .is("consumed_at", null)
    .maybeSingle();
  if (sessionError || !issuanceSession) {
    return jsonResponse({ error: "A sessão QR é inválida, expirou ou já foi utilizada. Prepare uma nova emissão." }, 409);
  }

  const bytes = new Uint8Array(await upload.arrayBuffer());
  if (!isPdf(bytes)) return jsonResponse({ error: "O conteúdo do ficheiro não é um PDF válido." }, 415);

  const fileHash = await sha256Hex(bytes);
  const storagePath = "suporte-informatica/" + documentId + ".pdf";
  const storage = ctx.supabaseAdmin.storage.from(DOCUMENT_BUCKET);
  const pdfBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfBuffer).set(bytes);

  let reusedExistingObject = false;
  const { error: uploadError } = await storage.upload(
    storagePath,
    new Blob([pdfBuffer], { type: "application/pdf" }),
    { contentType: "application/pdf", upsert: false },
  );
  if (uploadError) {
    // A retry may encounter the same PDF uploaded by an earlier attempt.
    // Reuse it only when the stored bytes hash exactly matches this request.
    const { data: existingInfo, error: existingInfoError } = await storage.info(storagePath);
    if (existingInfoError || !existingInfo || Number(existingInfo.size) !== bytes.byteLength) {
      console.error("CIADI TI PDF upload failed:", uploadError.message);
      return jsonResponse({ error: "Já existe um ficheiro neste rascunho e não foi possível confirmar que é o mesmo PDF." }, 409);
    }
    const { data: existingBlob, error: existingDownloadError } = await storage.download(storagePath);
    if (existingDownloadError || !existingBlob) {
      return jsonResponse({ error: "Não foi possível confirmar o ficheiro previamente carregado." }, 409);
    }
    const existingBytes = new Uint8Array(await existingBlob.arrayBuffer());
    const existingHash = await sha256Hex(existingBytes);
    if (!constantTimeEqual(existingHash, fileHash)) {
      return jsonResponse({ error: "O arquivo já contém outro PDF para este rascunho. É necessária revisão antes de substituir." }, 409);
    }
    reusedExistingObject = true;
  }

  try {
    const { data: info, error: infoError } = await storage.info(storagePath);
    const actualSize = Number(info?.size ?? 0);
    const actualMime = String(info?.metadata?.mimetype ?? info?.contentType ?? "");
    if (
      infoError || actualSize !== bytes.byteLength || actualSize < 1 ||
      actualSize > MAX_PDF_BYTES || actualMime !== "application/pdf"
    ) {
      throw new Error("Storage metadata validation failed");
    }

    const { data: number, error: issueError } = await db.rpc("issue_document", {
      p_document_id: documentId,
      p_actor_id: actorId,
      p_sha256: fileHash,
      p_verification_token_hash: tokenHash,
      p_file_size_bytes: actualSize,
    });

    if (issueError || typeof number !== "string" || !number) {
      // Re-read before taking any cleanup action. If the transaction committed
      // but the response was lost, return the committed document and keep its PDF.
      const { data: afterError, error: readAfterError } = await db
        .from("documents")
        .select("id,document_type_code,title,status,document_number,verification_token_hash,issued_at")
        .eq("id", documentId)
        .maybeSingle();
      if (!readAfterError && afterError?.status === "issued" &&
          constantTimeEqual(String(afterError.verification_token_hash || ""), tokenHash)) {
        return issuedResponse(documentId, afterError, url, true);
      }
      console.error("CIADI TI issue RPC failed:", issueError?.message || "invalid RPC result");
      // Keep the uploaded object on an indeterminate outcome. Deleting it could
      // break a transaction that committed while its response was interrupted.
      const outcome = readAfterError ? "unknown" : (afterError?.status || "unknown");
      return jsonResponse({
        error: "A emissão não foi confirmada. O PDF foi preservado para recuperação segura.",
        outcome,
        reusedExistingObject,
      }, 500);
    }

    const { data: issuedDocument, error: issuedReadError } = await db
      .from("documents")
      .select("id,document_type_code,title,status,document_number,issued_at,verification_token_hash")
      .eq("id", documentId)
      .maybeSingle();
    if (issuedReadError || !issuedDocument || issuedDocument.status !== "issued" ||
        issuedDocument.document_number !== number ||
        !constantTimeEqual(String(issuedDocument.verification_token_hash || ""), tokenHash)) {
      return jsonResponse({ error: "A RPC respondeu, mas não foi possível confirmar o registo emitido." }, 500);
    }
    return issuedResponse(documentId, issuedDocument, url);
  } catch (error) {
    console.error("CIADI TI document issue failed:", error instanceof Error ? error.message : "unknown error");
    // Do not delete an uploaded object automatically on an ambiguous outcome.
    return jsonResponse({
      error: "A emissão não foi confirmada. O PDF foi preservado para recuperação segura.",
      reusedExistingObject,
    }, 500);
  }
});

export default {
  fetch: (req: Request) => req.method === "OPTIONS"
    ? new Response("ok", { headers: corsHeaders() })
    : handler(req),
};
