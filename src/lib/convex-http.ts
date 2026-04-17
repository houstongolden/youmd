import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\\n/g, "").trim() ||
  "https://kindly-cassowary-600.convex.cloud";

let client: ConvexHttpClient | null = null;

export function getConvexHttpClient() {
  if (!client) {
    client = new ConvexHttpClient(convexUrl);
  }
  return client;
}

export { api };
