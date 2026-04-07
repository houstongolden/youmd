/**
 * Private vault encryption utilities.
 *
 * Uses AES-256-GCM for data encryption and PBKDF2 for key derivation
 * from a user-chosen vault passphrase. The vault key is a random
 * 256-bit key that gets wrapped (encrypted) with the PBKDF2-derived
 * key and stored locally at ~/.youmd/vault-key.enc.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const ALGORITHM = "aes-256-gcm";
const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // GCM standard
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

const VAULT_KEY_FILE = path.join(os.homedir(), ".youmd", "vault-key.enc");

// ── Key generation ────────────────────────────────────────────

/** Generate a random 256-bit AES key. */
export function generateVaultKey(): Uint8Array {
  return new Uint8Array(crypto.randomBytes(KEY_LENGTH));
}

// ── PBKDF2 key derivation ─────────────────────────────────────

/** Derive a 256-bit key from a passphrase and salt using PBKDF2. */
export function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array
): Buffer {
  return crypto.pbkdf2Sync(
    passphrase,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    "sha256"
  );
}

// ── Vault key wrapping ────────────────────────────────────────

export interface WrappedVaultKey {
  encrypted: Uint8Array;
  salt: Uint8Array;
  iv: Uint8Array;
}

/** Encrypt the vault key with a passphrase-derived key. */
export function encryptVaultKey(
  vaultKey: Uint8Array,
  passphrase: string
): WrappedVaultKey {
  const salt = new Uint8Array(crypto.randomBytes(SALT_LENGTH));
  const derivedKey = deriveKeyFromPassphrase(passphrase, salt);
  const iv = new Uint8Array(crypto.randomBytes(IV_LENGTH));

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(vaultKey)),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Append auth tag to ciphertext
  const withTag = new Uint8Array(encrypted.length + AUTH_TAG_LENGTH);
  withTag.set(new Uint8Array(encrypted), 0);
  withTag.set(new Uint8Array(authTag), encrypted.length);

  return { encrypted: withTag, salt, iv };
}

/** Decrypt the vault key using the passphrase. Throws on wrong passphrase. */
export function decryptVaultKey(
  encrypted: Uint8Array,
  passphrase: string,
  salt: Uint8Array,
  iv: Uint8Array
): Uint8Array {
  const derivedKey = deriveKeyFromPassphrase(passphrase, salt);

  const ciphertext = encrypted.slice(0, encrypted.length - AUTH_TAG_LENGTH);
  const authTag = encrypted.slice(encrypted.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(Buffer.from(authTag));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext)),
    decipher.final(),
  ]);

  return new Uint8Array(decrypted);
}

// ── Data encryption / decryption ──────────────────────────────

export interface EncryptedData {
  ciphertext: Uint8Array;
  iv: Uint8Array;
}

/** Encrypt arbitrary string data with the vault key. */
export function encryptData(
  data: string,
  vaultKey: Uint8Array
): EncryptedData {
  const iv = new Uint8Array(crypto.randomBytes(IV_LENGTH));
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(vaultKey),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(data, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Append auth tag to ciphertext
  const withTag = new Uint8Array(encrypted.length + AUTH_TAG_LENGTH);
  withTag.set(new Uint8Array(encrypted), 0);
  withTag.set(new Uint8Array(authTag), encrypted.length);

  return { ciphertext: withTag, iv };
}

/** Decrypt data with the vault key. Throws on tampered data. */
export function decryptData(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  vaultKey: Uint8Array
): string {
  const encrypted = ciphertext.slice(
    0,
    ciphertext.length - AUTH_TAG_LENGTH
  );
  const authTag = ciphertext.slice(ciphertext.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(vaultKey),
    iv
  );
  decipher.setAuthTag(Buffer.from(authTag));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted)),
    decipher.final(),
  ]);

  return decrypted.toString("utf-8");
}

// ── Local vault key persistence ───────────────────────────────

/**
 * Binary format for vault-key.enc:
 *   [1 byte version] [32 bytes salt] [12 bytes iv] [remaining: encrypted key + auth tag]
 */
const VAULT_FILE_VERSION = 1;

/** Save the wrapped vault key to ~/.youmd/vault-key.enc */
export function saveVaultKey(wrapped: WrappedVaultKey): void {
  const dir = path.dirname(VAULT_KEY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const buf = Buffer.alloc(
    1 + SALT_LENGTH + IV_LENGTH + wrapped.encrypted.length
  );
  let offset = 0;

  buf.writeUInt8(VAULT_FILE_VERSION, offset);
  offset += 1;

  Buffer.from(wrapped.salt).copy(buf, offset);
  offset += SALT_LENGTH;

  Buffer.from(wrapped.iv).copy(buf, offset);
  offset += IV_LENGTH;

  Buffer.from(wrapped.encrypted).copy(buf, offset);

  fs.writeFileSync(VAULT_KEY_FILE, buf, { mode: 0o600 });
}

/** Load the wrapped vault key from ~/.youmd/vault-key.enc */
export function loadVaultKey(): WrappedVaultKey | null {
  if (!fs.existsSync(VAULT_KEY_FILE)) {
    return null;
  }

  const buf = fs.readFileSync(VAULT_KEY_FILE);

  const version = buf.readUInt8(0);
  if (version !== VAULT_FILE_VERSION) {
    throw new Error(
      `Unsupported vault key file version: ${version}`
    );
  }

  let offset = 1;

  const salt = new Uint8Array(buf.slice(offset, offset + SALT_LENGTH));
  offset += SALT_LENGTH;

  const iv = new Uint8Array(buf.slice(offset, offset + IV_LENGTH));
  offset += IV_LENGTH;

  const encrypted = new Uint8Array(buf.slice(offset));

  return { encrypted, salt, iv };
}

/** Check if the vault has been initialized locally. */
export function isVaultInitialized(): boolean {
  return fs.existsSync(VAULT_KEY_FILE);
}

// ── Helpers for binary <-> base64 transport ───────────────────

/** Convert Uint8Array to base64 for JSON transport. */
export function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

/** Convert base64 string back to Uint8Array. */
export function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}
