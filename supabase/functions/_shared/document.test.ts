import {
  TOKEN_RE,
  constantTimeEqual,
  createVerificationToken,
  isPdf,
  renderVerificationPage,
  sha256Hex,
} from "./document.ts";

Deno.test("verification token is high-entropy base64url and matches expected shape", () => {
  const token = createVerificationToken();
  if (!TOKEN_RE.test(token)) throw new Error("Token shape invalid");
  if (createVerificationToken() === token) throw new Error("Token repeated");
});

Deno.test("PDF validation requires header and EOF marker", () => {
  const valid = new TextEncoder().encode("%PDF-1.7\nbody\n%%EOF");
  const invalid = new TextEncoder().encode("<html>not a pdf</html>");
  if (!isPdf(valid)) throw new Error("Valid PDF fixture rejected");
  if (isPdf(invalid)) throw new Error("Non-PDF accepted");
});

Deno.test("SHA-256 returns lowercase 64-character hex", async () => {
  const hash = await sha256Hex(new TextEncoder().encode("CIADI"));
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("SHA-256 shape invalid");
  if (hash !== "e9a276d5e5a1d6a326f185a37f93bc3ce5430690ba302dd4cf7d83a6c05e4d6f") {
    throw new Error("SHA-256 known-answer vector mismatch");
  }
});

Deno.test("constant-time comparison rejects mismatches", () => {
  if (!constantTimeEqual("aabb", "aabb")) throw new Error("Equal values rejected");
  if (constantTimeEqual("aabb", "aabc")) throw new Error("Mismatch accepted");
  if (constantTimeEqual("a", "aa")) throw new Error("Length mismatch accepted");
});

Deno.test("verification page renders the CIADI identity and escapes document data", () => {
  const html = renderVerificationPage({
    valid: true,
    documentNumber: '<img src=x onerror="alert(1)">',
    documentType: "SUP-REL",
    issuedAt: "2026-11-09T10:00:00Z",
  });
  if (!html.includes("CENTRO INTEGRADO DE APOIO E DESENVOLVIMENTO INDIVIDUAL")) {
    throw new Error("CIADI identity missing from verification page");
  }
  if (!html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;")) {
    throw new Error("Document data was not HTML-escaped");
  }
  if (html.includes('<img src=x onerror="alert(1)">')) {
    throw new Error("Unescaped document data found in HTML");
  }
  if (!html.includes("Documento autêntico") || !html.includes("VALIDADO")) {
    throw new Error("Valid document status missing");
  }
});

Deno.test("invalid verification page does not disclose document details", () => {
  const html = renderVerificationPage({
    valid: false,
    documentNumber: "SUP-SECRET/2026/000001",
    documentType: "PRIVATE",
    issuedAt: "2026-11-09",
  });
  if (!html.includes("Documento não verificado") || !html.includes("NÃO VALIDADO")) {
    throw new Error("Invalid document status missing");
  }
  if (html.includes("SUP-SECRET") || html.includes("PRIVATE") || html.includes("2026-11-09")) {
    throw new Error("Invalid page disclosed document details");
  }
});
