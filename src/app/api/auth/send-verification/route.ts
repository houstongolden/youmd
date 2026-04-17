import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-http";
import { hashOpaqueToken } from "@/lib/auth-session";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 6) {
  let value = "";
  for (let i = 0; i < length; i++) {
    value += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return value;
}

function randomToken() {
  return `youmd_verify_${crypto.randomUUID().replace(/-/g, "")}`;
}

function appUrl() {
  return (
    process.env.AUTH_ISSUER_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://you.md")
  );
}

function buildEmailHtml(args: {
  code: string;
  link: string;
  type: "login" | "signup";
}) {
  const heading =
    args.type === "login" ? "Your you.md sign-in code" : "Verify your email for you.md";
  const body =
    args.type === "login"
      ? "Use this code to sign in to your you.md account."
      : "Use this code to finish creating your you.md account.";

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#0d0d0d;color:#eae6e1;font-family:Inter,system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;border:1px solid #2a2a2a;background:#171717;padding:32px;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;color:#c46a3a;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:16px;">you.md</div>
    <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:600;color:#f5f1ec;">${heading}</h1>
    <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#b8aea4;">${body}</p>
    <div style="border:1px solid #2a2a2a;background:#101010;padding:18px 20px;margin-bottom:24px;">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8b8177;margin-bottom:6px;">verification code</div>
      <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:34px;letter-spacing:0.18em;color:#f5f1ec;">${args.code}</div>
    </div>
    <a href="${args.link}" style="display:inline-block;padding:12px 20px;border:1px solid #c46a3a;color:#f5f1ec;text-decoration:none;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;">open you.md</a>
    <p style="margin:24px 0 0 0;font-size:12px;color:#8b8177;line-height:1.6;">This code expires in 15 minutes. If you did not request this, ignore this email.</p>
  </div>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const type = body.type === "signup" ? "signup" : "login";
    const username = body.username ? String(body.username).trim().toLowerCase() : undefined;
    const displayName = body.displayName ? String(body.displayName).trim() : undefined;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    if (type === "signup" && !username) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    const code = randomCode();
    const token = randomToken();
    const client = getConvexHttpClient();

    await client.mutation(api.auth.startEmailAuth, {
      email,
      type,
      codeHash: hashOpaqueToken(code),
      tokenHash: hashOpaqueToken(token),
      username,
      displayName,
    });

    const link = `${appUrl()}/api/auth/verify-link?token=${encodeURIComponent(token)}`;
    const resendKey =
      process.env.RESEND_API_KEY ||
      process.env.FOLDERMD_RESEND_API_KEY;
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "you.md <onboarding@resend.dev>",
          to: email,
          subject:
            type === "login"
              ? "Your you.md sign-in code"
              : "Verify your email for you.md",
          html: buildEmailHtml({ code, link, type }),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { error: `Email delivery failed: ${text}` },
          { status: 502 }
        );
      }
    } else if (isProduction) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      email,
      ...(!isProduction ? { devCode: code, devLink: link } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send verification." },
      { status: 500 }
    );
  }
}
