import { readFile } from "fs/promises";
import { homedir } from "os";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-http";
import {
  SESSION_COOKIE_MAX_AGE,
  SESSION_COOKIE_NAME,
  generateOpaqueToken,
  hashOpaqueToken,
} from "@/lib/auth-session";
import type { Id } from "../../../../../convex/_generated/dataModel";

export const runtime = "nodejs";

type LocalYoumdConfig = {
  apiUrl?: string;
  token?: string;
};

type MeResponse = {
  user?: {
    _id?: string;
  };
};

function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const clean = host.toLowerCase();
  if (clean === "::1" || clean.startsWith("[::1]")) return true;
  const hostname = clean.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/shell?tab=home";
  }
  return value;
}

async function readLocalConfig(): Promise<LocalYoumdConfig | null> {
  try {
    return JSON.parse(
      await readFile(path.join(homedir(), ".youmd", "config.json"), "utf8")
    ) as LocalYoumdConfig;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!isLocalHost(request.headers.get("host"))) {
    return NextResponse.json(
      {
        error: "local browser session bootstrap is only available from localhost",
        localOnly: true,
      },
      { status: 403 }
    );
  }

  const config = await readLocalConfig();
  const apiUrl = config?.apiUrl?.trim();
  const token = config?.token?.trim();
  if (!apiUrl || !token) {
    return NextResponse.json(
      {
        error: "local You.md CLI session not found; run `youmd login` first",
        localOnly: true,
      },
      { status: 401 }
    );
  }

  const meRes = await fetch(`${apiUrl.replace(/\/$/, "")}/api/v1/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "you.md-local-browser-session",
    },
    cache: "no-store",
  });

  if (!meRes.ok) {
    return NextResponse.json(
      {
        error: "local You.md CLI session could not be verified",
        localOnly: true,
      },
      { status: 401 }
    );
  }

  const me = (await meRes.json()) as MeResponse;
  const userId = me.user?._id;
  if (!userId) {
    return NextResponse.json(
      {
        error: "local You.md CLI session did not include an account id",
        localOnly: true,
      },
      { status: 401 }
    );
  }

  const sessionToken = generateOpaqueToken();
  await getConvexHttpClient().mutation(api.auth.createSession, {
    userId: userId as Id<"users">,
    tokenHash: hashOpaqueToken(sessionToken),
    userAgent: request.headers.get("user-agent") ?? "you.md-local-browser",
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  const redirectUrl = new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.url);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
  return response;
}
