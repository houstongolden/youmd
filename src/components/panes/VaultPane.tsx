"use client";

/**
 * VaultPane — manage encrypted private vault from the web shell.
 *
 * The vault stores private notes, projects, and links encrypted with
 * AES-256-GCM. The vault key is wrapped with a passphrase-derived
 * PBKDF2 key. Plaintext only ever lives in memory and is wiped on lock.
 *
 * Server only sees ciphertext + the wrapped vault key.
 */

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback, useEffect, useRef } from "react";
import { PaneHeader, PaneSectionLabel as SectionLabel, PaneDivider as Divider } from "./shared";

interface VaultPaneProps {
  clerkId: string;
}

interface VaultContents {
  notes: string;
  projects: Array<{ name: string; description: string; status: string }>;
  links: Array<{ label: string; url: string }>;
}

const EMPTY_VAULT: VaultContents = {
  notes: "",
  projects: [],
  links: [],
};

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;
const SALT_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;

// ── Web crypto helpers ──────────────────────────────────────────────
//
// All key material is passed around as ArrayBuffer (NOT Uint8Array) to keep
// TypeScript happy with the lib.dom Web Crypto signatures. Uint8Array's
// underlying buffer is typed as ArrayBufferLike, which TS refuses where
// ArrayBuffer is required.

function randomArrayBuffer(n: number): ArrayBuffer {
  const u = new Uint8Array(n);
  crypto.getRandomValues(u);
  // Return a fresh ArrayBuffer copy so the type is exactly ArrayBuffer.
  const out = new ArrayBuffer(n);
  new Uint8Array(out).set(u);
  return out;
}

function utf8(s: string): ArrayBuffer {
  const enc = new TextEncoder().encode(s);
  const out = new ArrayBuffer(enc.byteLength);
  new Uint8Array(out).set(enc);
  return out;
}

function fromUtf8(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf);
}

async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: ArrayBuffer
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    utf8(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false,
    ["wrapKey", "unwrapKey", "encrypt", "decrypt"]
  );
}

async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    true,
    ["encrypt", "decrypt"]
  );
}

async function wrapVaultKey(
  vaultKey: CryptoKey,
  passphrase: string
): Promise<{
  wrappedVaultKey: ArrayBuffer;
  vaultSalt: ArrayBuffer;
  vaultKeyIv: ArrayBuffer;
}> {
  const vaultSalt = randomArrayBuffer(SALT_LENGTH_BYTES);
  const vaultKeyIv = randomArrayBuffer(IV_LENGTH_BYTES);
  const wrappingKey = await deriveKeyFromPassphrase(passphrase, vaultSalt);
  const wrapped = await crypto.subtle.wrapKey("raw", vaultKey, wrappingKey, {
    name: "AES-GCM",
    iv: vaultKeyIv,
  });
  return { wrappedVaultKey: wrapped, vaultSalt, vaultKeyIv };
}

async function unwrapVaultKey(
  wrappedVaultKey: ArrayBuffer,
  vaultSalt: ArrayBuffer,
  vaultKeyIv: ArrayBuffer,
  passphrase: string
): Promise<CryptoKey> {
  const wrappingKey = await deriveKeyFromPassphrase(passphrase, vaultSalt);
  return crypto.subtle.unwrapKey(
    "raw",
    wrappedVaultKey,
    wrappingKey,
    { name: "AES-GCM", iv: vaultKeyIv },
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptString(
  data: string,
  vaultKey: CryptoKey,
  iv: ArrayBuffer
): Promise<ArrayBuffer> {
  return crypto.subtle.encrypt({ name: "AES-GCM", iv }, vaultKey, utf8(data));
}

async function decryptToString(
  ciphertext: ArrayBuffer,
  vaultKey: CryptoKey,
  iv: ArrayBuffer
): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    vaultKey,
    ciphertext
  );
  return fromUtf8(plain);
}

// Convex `v.bytes()` round-trips as ArrayBuffer in the client. Normalize
// to a guaranteed ArrayBuffer (no SharedArrayBuffer ambiguity).
function asArrayBuffer(
  b: ArrayBuffer | Uint8Array | null | undefined
): ArrayBuffer | null {
  if (!b) return null;
  if (b instanceof ArrayBuffer) return b;
  // Copy a Uint8Array view into a fresh ArrayBuffer.
  const out = new ArrayBuffer(b.byteLength);
  new Uint8Array(out).set(b);
  return out;
}

// ── Component ───────────────────────────────────────────────────────

export function VaultPane({ clerkId }: VaultPaneProps) {
  const vault = useQuery(
    api.vault.getEncryptedVault,
    clerkId ? { clerkId } : "skip"
  );
  const initVault = useMutation(api.vault.initVault);
  const saveEncryptedVault = useMutation(api.vault.saveEncryptedVault);

  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // In-memory plaintext — wiped on lock.
  const vaultKeyRef = useRef<CryptoKey | null>(null);
  const [contents, setContents] = useState<VaultContents>(EMPTY_VAULT);

  // Drafts for new entries
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const initialized = !!(vault && vault.wrappedVaultKey && vault.vaultSalt && vault.vaultKeyIv);
  const hasCiphertext = !!(vault && vault.encryptedJson && vault.iv);

  const lock = useCallback(() => {
    vaultKeyRef.current = null;
    setUnlocked(false);
    setContents(EMPTY_VAULT);
    setPassphrase("");
    setConfirmPassphrase("");
    setError(null);
    setStatus("vault locked");
  }, []);

  // Auto-lock when navigating away from this pane (component unmount).
  useEffect(() => {
    return () => {
      vaultKeyRef.current = null;
    };
  }, []);

  const initialize = useCallback(async () => {
    setError(null);
    if (passphrase.length < 8) {
      setError("passphrase must be at least 8 characters");
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError("passphrases do not match");
      return;
    }
    setBusy(true);
    try {
      const key = await generateVaultKey();
      const wrap = await wrapVaultKey(key, passphrase);
      await initVault({
        clerkId,
        wrappedVaultKey: wrap.wrappedVaultKey,
        vaultSalt: wrap.vaultSalt,
        vaultKeyIv: wrap.vaultKeyIv,
      });
      vaultKeyRef.current = key;
      setUnlocked(true);
      setContents(EMPTY_VAULT);
      setStatus("vault initialized");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to initialize vault");
    }
    setBusy(false);
  }, [passphrase, confirmPassphrase, clerkId, initVault]);

  const unlock = useCallback(async () => {
    if (!vault) return;
    const wrappedVaultKey = asArrayBuffer(
      vault.wrappedVaultKey as unknown as ArrayBuffer
    );
    const vaultSalt = asArrayBuffer(vault.vaultSalt as unknown as ArrayBuffer);
    const vaultKeyIv = asArrayBuffer(vault.vaultKeyIv as unknown as ArrayBuffer);
    if (!wrappedVaultKey || !vaultSalt || !vaultKeyIv) {
      setError("vault metadata missing");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const key = await unwrapVaultKey(
        wrappedVaultKey,
        vaultSalt,
        vaultKeyIv,
        passphrase
      );

      // Load any existing ciphertext
      let next: VaultContents = EMPTY_VAULT;
      const encryptedJson = asArrayBuffer(
        vault.encryptedJson as unknown as ArrayBuffer
      );
      const iv = asArrayBuffer(vault.iv as unknown as ArrayBuffer);
      if (encryptedJson && iv) {
        try {
          const json = await decryptToString(encryptedJson, key, iv);
          const parsed = JSON.parse(json);
          if (parsed && typeof parsed === "object") {
            next = {
              notes: typeof parsed.notes === "string" ? parsed.notes : "",
              projects: Array.isArray(parsed.projects) ? parsed.projects : [],
              links: Array.isArray(parsed.links) ? parsed.links : [],
            };
          }
        } catch {
          setError("could not decrypt vault — wrong passphrase?");
          setBusy(false);
          return;
        }
      }

      vaultKeyRef.current = key;
      setContents(next);
      setUnlocked(true);
      setStatus("unlocked");
      setPassphrase("");
    } catch {
      setError("wrong passphrase");
    }
    setBusy(false);
  }, [vault, passphrase]);

  const save = useCallback(async () => {
    if (!vaultKeyRef.current) {
      setError("vault is locked");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const key = vaultKeyRef.current;
      const json = JSON.stringify(contents);
      const md = renderVaultMd(contents);
      const iv = randomArrayBuffer(IV_LENGTH_BYTES);
      const encJson = await encryptString(json, key, iv);
      const encMd = await encryptString(md, key, iv);
      await saveEncryptedVault({
        clerkId,
        encryptedJson: encJson,
        encryptedMd: encMd,
        iv,
      });
      setStatus("saved " + new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    }
    setBusy(false);
  }, [contents, clerkId, saveEncryptedVault]);

  const addProject = () => {
    if (!newProjectName.trim()) return;
    setContents((c) => ({
      ...c,
      projects: [
        ...c.projects,
        {
          name: newProjectName.trim(),
          description: newProjectDesc.trim(),
          status: "active",
        },
      ],
    }));
    setNewProjectName("");
    setNewProjectDesc("");
  };

  const removeProject = (idx: number) => {
    setContents((c) => ({
      ...c,
      projects: c.projects.filter((_, i) => i !== idx),
    }));
  };

  const addLink = () => {
    if (!newLinkUrl.trim()) return;
    setContents((c) => ({
      ...c,
      links: [
        ...c.links,
        {
          label: newLinkLabel.trim() || newLinkUrl.trim(),
          url: newLinkUrl.trim(),
        },
      ],
    }));
    setNewLinkLabel("");
    setNewLinkUrl("");
  };

  const removeLink = (idx: number) => {
    setContents((c) => ({
      ...c,
      links: c.links.filter((_, i) => i !== idx),
    }));
  };

  // ── Render ──────────────────────────────────────────────────────

  if (vault === undefined) {
    return (
      <div className="h-full overflow-y-auto">
        <PaneHeader>vault</PaneHeader>
        <div className="px-6 py-4 text-xs font-mono text-[hsl(var(--text-secondary))] opacity-60">
          loading...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>
        <div className="flex items-center justify-between w-full">
          <span>vault</span>
          {unlocked && (
            <button
              onClick={lock}
              className="font-mono text-[10px] text-[hsl(var(--accent))] hover:opacity-80"
            >
              lock
            </button>
          )}
        </div>
      </PaneHeader>

      <div className="px-6 py-4 space-y-4">
        {/* ── Always-visible explainer ─────────────────────────── */}
        <div
          className="border border-[hsl(var(--accent))] border-opacity-40 bg-[hsl(var(--accent))] bg-opacity-[0.03] p-4 space-y-3"
          style={{ borderRadius: "2px" }}
        >
          <div className="text-[11px] font-mono text-[hsl(var(--accent))] uppercase tracking-wider">
            the vault
          </div>
          <p className="text-[11px] font-mono text-[hsl(var(--text-primary))] opacity-80 leading-relaxed">
            Encrypted private notes that NEVER leave your control unencrypted.
            Only you can read them — even you.md servers can&apos;t.
          </p>

          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-[hsl(var(--accent))] uppercase tracking-wider opacity-80">
              when to use
            </div>
            <ul className="text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-70 leading-relaxed space-y-1 pl-3">
              <li>
                • Sensitive notes you don&apos;t want in normal private context
                (passwords, account IDs, confidential client info, etc.)
              </li>
              <li>
                • Items only YOU should see, not even agents with full-scope
                context links
              </li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-[hsl(var(--accent))] uppercase tracking-wider opacity-80">
              how it works
            </div>
            <ol className="text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-70 leading-relaxed space-y-1 pl-3">
              <li>
                1. Create vault with a passphrase (only known to you — we
                can&apos;t recover it)
              </li>
              <li>2. Add encrypted notes/keys/anything</li>
              <li>3. Unlock with passphrase to read</li>
              <li>4. Lock to clear from memory</li>
            </ol>
          </div>

          <p className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-50 leading-relaxed pt-1 border-t border-[hsl(var(--accent))] border-opacity-20">
            Vault is separate from &quot;private context&quot; (which IS shared
            with full-scope agents).
          </p>
        </div>

        {error && (
          <div className="text-[11px] font-mono text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))] border-opacity-30 rounded px-2 py-1">
            {error}
          </div>
        )}
        {status && !error && (
          <div className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-60">
            {status}
          </div>
        )}

        {!unlocked && !initialized && (
          <div className="space-y-3 border border-[hsl(var(--border))] p-4" style={{ borderRadius: "2px" }}>
            <SectionLabel>set up vault</SectionLabel>
            <p className="text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-60">
              choose a passphrase to create your encrypted vault. only you can decrypt it — we never see it, and we can&apos;t recover it.
            </p>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="passphrase (min 8 chars)"
              className="w-full text-[12px] font-mono px-3 py-2 bg-[hsl(var(--bg))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--accent))]"
            />
            <input
              type="password"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              placeholder="confirm passphrase"
              className="w-full text-[12px] font-mono px-3 py-2 bg-[hsl(var(--bg))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--accent))]"
            />
            <button
              onClick={initialize}
              disabled={busy}
              className="w-full py-2 text-[11px] font-mono text-[hsl(var(--accent))] border border-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))] hover:bg-opacity-10 disabled:opacity-40"
            >
              {busy ? "creating..." : "create vault"}
            </button>
          </div>
        )}

        {!unlocked && initialized && (
          <div className="space-y-3 border border-[hsl(var(--border))] p-4" style={{ borderRadius: "2px" }}>
            <SectionLabel>unlock vault</SectionLabel>
            <p className="text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-60">
              {hasCiphertext
                ? "enter your passphrase to view encrypted contents."
                : "vault initialized but empty. unlock to start adding contents."}
            </p>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="passphrase"
              onKeyDown={(e) => {
                if (e.key === "Enter") void unlock();
              }}
              className="w-full text-[12px] font-mono px-3 py-2 bg-[hsl(var(--bg))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--accent))]"
            />
            <button
              onClick={unlock}
              disabled={busy || !passphrase}
              className="w-full py-2 text-[11px] font-mono text-[hsl(var(--accent))] border border-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))] hover:bg-opacity-10 disabled:opacity-40"
            >
              {busy ? "unlocking..." : "unlock"}
            </button>
          </div>
        )}

        {unlocked && (
          <div className="space-y-6">
            {/* ── Notes ─────────────────────────────────── */}
            <div>
              <SectionLabel>private notes</SectionLabel>
              <textarea
                value={contents.notes}
                onChange={(e) =>
                  setContents((c) => ({ ...c, notes: e.target.value }))
                }
                rows={6}
                placeholder="anything you want only you to see..."
                className="w-full text-[12px] font-mono px-3 py-2 bg-[hsl(var(--bg))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--accent))] resize-y"
              />
            </div>

            <Divider />

            {/* ── Projects ──────────────────────────────── */}
            <div>
              <SectionLabel>private projects</SectionLabel>
              <div className="space-y-2">
                {contents.projects.length === 0 && (
                  <div className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40">
                    no private projects yet
                  </div>
                )}
                {contents.projects.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-2 border border-[hsl(var(--border))] px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-mono text-[hsl(var(--text-primary))]">
                        {p.name}
                      </div>
                      {p.description && (
                        <div className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-60 truncate">
                          {p.description}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeProject(idx)}
                      className="text-[10px] font-mono text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--destructive))]"
                    >
                      delete
                    </button>
                  </div>
                ))}
                <div className="flex flex-col gap-2 mt-2">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="project name"
                    className="text-[11px] font-mono px-2 py-1.5 bg-[hsl(var(--bg))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--accent))]"
                  />
                  <input
                    type="text"
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="description"
                    className="text-[11px] font-mono px-2 py-1.5 bg-[hsl(var(--bg))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--accent))]"
                  />
                  <button
                    onClick={addProject}
                    className="text-[10px] font-mono text-[hsl(var(--accent))] hover:opacity-80 self-start"
                  >
                    + add project
                  </button>
                </div>
              </div>
            </div>

            <Divider />

            {/* ── Links ─────────────────────────────────── */}
            <div>
              <SectionLabel>private links</SectionLabel>
              <div className="space-y-2">
                {contents.links.length === 0 && (
                  <div className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40">
                    no private links yet
                  </div>
                )}
                {contents.links.map((l, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 border border-[hsl(var(--border))] px-3 py-1.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-mono text-[hsl(var(--text-primary))]">
                        {l.label}
                      </div>
                      <div className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-60 truncate">
                        {l.url}
                      </div>
                    </div>
                    <button
                      onClick={() => removeLink(idx)}
                      className="text-[10px] font-mono text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--destructive))]"
                    >
                      delete
                    </button>
                  </div>
                ))}
                <div className="flex flex-col gap-2 mt-2">
                  <input
                    type="text"
                    value={newLinkLabel}
                    onChange={(e) => setNewLinkLabel(e.target.value)}
                    placeholder="label"
                    className="text-[11px] font-mono px-2 py-1.5 bg-[hsl(var(--bg))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--accent))]"
                  />
                  <input
                    type="text"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="text-[11px] font-mono px-2 py-1.5 bg-[hsl(var(--bg))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--accent))]"
                  />
                  <button
                    onClick={addLink}
                    className="text-[10px] font-mono text-[hsl(var(--accent))] hover:opacity-80 self-start"
                  >
                    + add link
                  </button>
                </div>
              </div>
            </div>

            <Divider />

            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 py-2 text-[11px] font-mono text-[hsl(var(--accent))] border border-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))] hover:bg-opacity-10 disabled:opacity-40"
              >
                {busy ? "encrypting..." : "save (encrypted)"}
              </button>
              <button
                onClick={lock}
                className="py-2 px-4 text-[11px] font-mono text-[hsl(var(--text-secondary))] border border-[hsl(var(--border))] hover:text-[hsl(var(--text-primary))]"
              >
                lock
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Render the vault contents as markdown for the encryptedMd field —
// gives the CLI a clean, human-readable form when synced down.
function renderVaultMd(c: VaultContents): string {
  const lines: string[] = ["# private vault", ""];

  if (c.notes) {
    lines.push("## notes", "", c.notes, "");
  }

  if (c.projects.length > 0) {
    lines.push("## private projects", "");
    for (const p of c.projects) {
      lines.push(`### ${p.name}`);
      if (p.status) lines.push(`**status:** ${p.status}`);
      if (p.description) lines.push("", p.description);
      lines.push("");
    }
  }

  if (c.links.length > 0) {
    lines.push("## private links", "");
    for (const l of c.links) {
      lines.push(`- **${l.label}**: ${l.url}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
