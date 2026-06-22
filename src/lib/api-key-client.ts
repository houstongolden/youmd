export type BrowserApiKeyResult = {
  key: string;
  scopes: string[];
  label?: string;
  expiresAt?: number | null;
};

export async function createBrowserApiKey(options: {
  label?: string;
  scopes?: string[];
  expiresInDays?: number | null;
  revokeExisting?: boolean;
}): Promise<BrowserApiKeyResult> {
  const res = await fetch("/api/auth/api-keys", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(options),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<BrowserApiKeyResult>;

  if (!res.ok) {
    throw new Error(data.error || "Failed to create API key.");
  }
  if (!data.key || !Array.isArray(data.scopes)) {
    throw new Error("API key response was incomplete.");
  }

  return {
    key: data.key,
    scopes: data.scopes,
    label: data.label,
    expiresAt: data.expiresAt,
  };
}
