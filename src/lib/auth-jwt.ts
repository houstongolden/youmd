import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  generateKeyPairSync,
  KeyObject,
} from "crypto";

const DEV_KEY_CACHE = globalThis as typeof globalThis & {
  __youmdDevJwtKey?: { privateKey: KeyObject; publicKey: KeyObject };
};

function base64UrlEncode(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizePem(value: string | undefined) {
  return value?.replace(/\\n/g, "\n").trim();
}

function looksLocalUrl(value: string | undefined) {
  if (!value) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value.trim());
}

function usesRemoteConvex() {
  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL?.trim() ||
    process.env.CONVEX_URL?.trim() ||
    "";
  if (!convexUrl) return false;
  return !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(convexUrl);
}

function getIssuerBaseUrl() {
  const explicitIssuer = process.env.AUTH_ISSUER_URL?.trim();
  if (explicitIssuer) {
    // Local web dev commonly points at a remote Convex deployment. In that
    // setup, minting localhost-issued JWTs makes Convex reject every request
    // with `NoAuthProvider`. Keep localhost app URLs for links/cookies, but
    // sign tokens for the remote issuer unless the backend is also local.
    if (looksLocalUrl(explicitIssuer) && usesRemoteConvex()) {
      return "https://you.md";
    }
    return explicitIssuer;
  }

  if (process.env.NODE_ENV === "production") {
    return "https://you.md";
  }

  if (usesRemoteConvex()) {
    return "https://you.md";
  }

  return "http://localhost:3000";
}

function getKeyPair() {
  const privatePem = normalizePem(process.env.AUTH_JWT_PRIVATE_KEY_PEM);
  const publicPem = normalizePem(process.env.AUTH_JWT_PUBLIC_KEY_PEM);

  if (privatePem) {
    return {
      privateKey: createPrivateKey(privatePem),
      publicKey: createPublicKey(publicPem || privatePem),
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_PRIVATE_KEY_PEM is required in production.");
  }

  if (!DEV_KEY_CACHE.__youmdDevJwtKey) {
    DEV_KEY_CACHE.__youmdDevJwtKey = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
  }

  return DEV_KEY_CACHE.__youmdDevJwtKey;
}

function getKid(publicKey: KeyObject) {
  const pem = publicKey.export({ format: "pem", type: "spki" }).toString();
  return createHash("sha256").update(pem).digest("hex").slice(0, 16);
}

export function getJwksPayload() {
  const { publicKey } = getKeyPair();
  const jwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
  return {
    keys: [
      {
        ...jwk,
        use: "sig",
        alg: "RS256",
        kid: getKid(publicKey),
      },
    ],
  };
}

export function signConvexToken(payload: {
  subject: string;
  email: string;
  username: string;
  displayName?: string | null;
}) {
  const issuer = getIssuerBaseUrl();
  const { privateKey, publicKey } = getKeyPair();
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: getKid(publicKey),
  };
  const claims = {
    iss: issuer,
    sub: payload.subject,
    aud: "convex",
    iat: now,
    exp: now + 60 * 10,
    email: payload.email,
    email_verified: true,
    preferred_username: payload.username,
    name: payload.displayName || payload.username,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${signingInput}.${base64UrlEncode(signature)}`;
}
