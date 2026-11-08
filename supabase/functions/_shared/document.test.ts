import {
  TOKEN_RE,
  constantTimeEqual,
  createVerificationToken,
  isPdf,
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
  }
});

Deno.test("constant-time comparison rejects mismatches", () => {
  if (!constantTimeEqual("aabb", "aabb")) throw new Error("Equal values rejected");
  if (constantTimeEqual("aabb", "aabc")) throw new Error("Mismatch accepted");
  if (constantTimeEqual("a", "aa")) throw new Error("Length mismatch accepted");
});
