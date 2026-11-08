import { withSupabase } from "@supabase/server";
import {
  DOCUMENT_BUCKET,
  MAX_PDF_BYTES,
  UUID_RE,
  corsHeaders,
  createVerificationToken,
  isPdf,
  jsonResponse,
  sha256Hex,
} from "../_shared/document.ts";

const SUPPORT_ROLES = new Set(["admin", "gestor", "suporte_informatica"]);

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
  const upload = form.get("file");
  if (!UUID_RE.test(documentId) || !(upload instanceof File)) {
    return jsonResponse({ error: "Identificador ou ficheiro PDF em falta." }, 400);
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

  const db = ctx.supabaseAdmin.schema("ciadi_ti");
  const { data: document, error: documentError } = await db
    .from("documents")
    .select("id,document_type_code,title,status")
    .eq("id", documentId)
    .maybeSingle();
  if (documentError || !document) return jsonResponse({ error: "Documento não encontrado." }, 404);
  if (document.status !== "draft") return jsonResponse({ error: "Só é possível emitir um rascunho." }, 409);

  const bytes = new Uint8Array(await upload.arrayBuffer());
  if (!isPdf(bytes)) return jsonResponse({ error: "O conteúdo do ficheiro não é um PDF válido." }, 415);

  const token = createVerificationToken();
  const tokenHash = await sha256Hex(new TextEncoder().encode(token));
  const fileHash = await sha256Hex(bytes);
  const verificationUrl = new URL("/functions/v1/ciadi-ti-verify-document", supabaseUrl);
  verificationUrl.searchParams.set("document_id", documentId);
  verificationUrl.searchParams.set("token", token);

  const storagePath = "suporte-informatica/" + documentId + ".pdf";
  const storage = ctx.supabaseAdmin.storage.from(DOCUMENT_BUCKET);
  const { error: uploadError } = await storage.upload(
    storagePath,
    new Blob([bytes], { type: "application/pdf" }),
    { contentType: "application/pdf", upsert: false },
  );
  if (uploadError) {
    console.error("CIADI TI PDF upload failed:", uploadError.message);
    return jsonResponse({ error: "Não foi possível arquivar o PDF." }, 409);
  }

  let issued = false;
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
      console.error("CIADI TI issue RPC failed:", issueError?.message || "invalid RPC result");
      throw new Error("Document issue operation failed");
    }
    issued = true;

    return jsonResponse({
      ok: true,
      document: {
        id: documentId,
        number,
        type: document.document_type_code,
        title: document.title,
        status: "issued",
      },
      verificationUrl: verificationUrl.toString(),
    });
  } catch (error) {
    if (!issued) {
      const { error: cleanupError } = await storage.remove([storagePath]);
      if (cleanupError) console.error("CIADI TI orphan PDF cleanup failed:", cleanupError.message);
    }
    console.error("CIADI TI document issue failed:", error instanceof Error ? error.message : "unknown error");
    return jsonResponse({ error: "A emissão não foi concluída. O documento não foi confirmado como emitido." }, 500);
  }
});

export default {
  fetch: (req: Request) => req.method === "OPTIONS"
    ? new Response("ok", { headers: corsHeaders() })
    : handler(req),
};
