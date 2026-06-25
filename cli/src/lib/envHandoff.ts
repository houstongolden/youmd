import * as crypto from "crypto";

// ── Zero-knowledge env handoff crypto ──────────────────────────
//
// Everything in here runs on the LOCAL machine. The you.md server only
// ever receives ciphertext + a hash of the access code's lookup id. The
// AES-256-GCM key lives inside the access code and never leaves the
// device that minted it (on share) or the device that claims it (on pull).
//
// Access code format:  ymenv1_<handoffId>.<keyB64url>
//   handoffId  16 random bytes, hex      -> server stores SHA-256(handoffId)
//   keyB64url  32 random bytes, base64url -> NEVER sent to the server

export const ACCESS_CODE_PREFIX = "ymenv1_";

export interface MintedCode {
  /** The full access code to hand to the destination machine. */
  code: string;
  /** SHA-256 hex of the lookup id half — safe to send to the server. */
  codeHash: string;
  /** Raw 32-byte AES key — stays local. */
  key: Buffer;
}

export interface ParsedCode {
  codeHash: string;
  key: Buffer;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** Mint a fresh access code + its server-side lookup hash + local key. */
export function mintAccessCode(): MintedCode {
  const handoffId = crypto.randomBytes(16).toString("hex");
  const key = crypto.randomBytes(32);
  const code = `${ACCESS_CODE_PREFIX}${handoffId}.${b64url(key)}`;
  return { code, codeHash: sha256Hex(handoffId), key };
}

/** Parse an access code back into the server lookup hash + local key. */
export function parseAccessCode(raw: string): ParsedCode {
  const code = raw.trim();
  if (!code.startsWith(ACCESS_CODE_PREFIX)) {
    throw new Error("invalid access code (expected an ymenv1_ code)");
  }
  const rest = code.slice(ACCESS_CODE_PREFIX.length);
  const dot = rest.indexOf(".");
  if (dot < 0) throw new Error("invalid access code (missing key segment)");
  const handoffId = rest.slice(0, dot);
  const keyPart = rest.slice(dot + 1);
  if (!/^[0-9a-f]{32}$/i.test(handoffId)) {
    throw new Error("invalid access code (bad id segment)");
  }
  const key = b64urlDecode(keyPart);
  if (key.length !== 32) throw new Error("invalid access code (bad key length)");
  return { codeHash: sha256Hex(handoffId), key };
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

/** AES-256-GCM encrypt a .env.local body with a local key. */
export function encryptEnv(plaintext: string, key: Buffer): EncryptedPayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/** AES-256-GCM decrypt a payload with a local key. */
export function decryptEnv(payload: EncryptedPayload, key: Buffer): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const out = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return out.toString("utf8");
}

/** Extract variable NAMES only from a .env body — never the values. */
export function extractVarNames(envText: string): string[] {
  const names: string[] = [];
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m) names.push(m[1]);
  }
  return Array.from(new Set(names));
}
