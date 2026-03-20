"use client";

import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { TerminalAuthInput } from "@/components/terminal/TerminalAuthInput";

/* ── Clerk error extraction ────────────────────────────────── */

function extractError(err: unknown): string {
  const clerkErr = err as {
    errors?: { message?: string; longMessage?: string }[];
    message?: string;
  };
  return (
    clerkErr.errors?.[0]?.longMessage ??
    clerkErr.errors?.[0]?.message ??
    clerkErr.message ??
    "initialization failed. try again."
  );
}

/* ── Main page ─────────────────────────────────────────────── */

type Step = "boot" | "email" | "password" | "username" | "processing" | "verify" | "verifying" | "done";

export default function SignUpPage() {
  const signUpHook = useSignUp();
  const signUp = signUpHook.signUp;
  const router = useRouter();

  const [step, setStep] = useState<Step>("boot");
  const [lines, setLines] = useState<{ id: string; content: ReactNode; className?: string }[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineCounter = useRef(0);

  const addLine = useCallback((content: ReactNode, className?: string) => {
    const id = `l${lineCounter.current++}`;
    setLines((prev) => [...prev, { id, content, className }]);
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, step]);

  // Boot sequence
  useEffect(() => {
    const timers = [
      setTimeout(() => addLine("you.md v0.1.0", "text-[hsl(var(--accent))]"), 200),
      setTimeout(() => addLine("identity context protocol for the agent internet", "text-[hsl(var(--text-secondary))] opacity-60"), 600),
      setTimeout(() => addLine("\u00A0"), 900),
      setTimeout(() => addLine("initializing authentication...", "text-[hsl(var(--text-secondary))] opacity-50"), 1100),
      setTimeout(() => addLine("\u00A0"), 1400),
      setTimeout(() => setStep("email"), 1600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [addLine]);

  // Handlers
  const handleEmail = useCallback((val: string) => {
    setEmail(val);
    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">email:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">{val}</span>
      </span>
    );
    addLine("\u00A0");
    setTimeout(() => setStep("password"), 300);
  }, [addLine]);

  const handlePassword = useCallback((val: string) => {
    setPassword(val);
    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">password:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">{"\u2022".repeat(val.length)}</span>
      </span>
    );
    addLine("\u00A0");
    setTimeout(() => setStep("username"), 300);
  }, [addLine]);

  const handleUsername = useCallback(async (val: string) => {
    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">username:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">{val}</span>
      </span>
    );
    addLine("\u00A0");
    setStep("processing");

    if (!signUp) return;

    // Check username availability against Convex FIRST
    addLine("checking username availability...", "text-[hsl(var(--text-secondary))] opacity-50");
    try {
      const checkRes = await fetch(
        `https://kindly-cassowary-600.convex.site/api/v1/check-username?username=${encodeURIComponent(val)}`
      );
      const checkData = await checkRes.json();
      if (!checkData.available) {
        addLine(
          <span className="text-[hsl(var(--accent))]">
            ERR: @{val} is not available. {checkData.reason || "try another username."}
          </span>
        );
        addLine("\u00A0");
        setStep("username");
        return;
      }
      addLine(
        <span className="text-[hsl(var(--success))]">{"\u2713"} @{val} is available</span>
      );
    } catch {
      // If check fails, proceed anyway — Clerk/Convex will catch duplicates
    }

    addLine("initializing identity bundle...", "text-[hsl(var(--text-secondary))] opacity-50");

    try {
      const result = await signUp.password({
        emailAddress: email,
        password,
        username: val,
      });

      if (result.error) {
        addLine(
          <span className="text-[hsl(var(--accent))]">
            ERR: {result.error.message ?? "initialization failed."}
          </span>
        );
        addLine("\u00A0");
        setStep("username");
        return;
      }

      if (signUp.status === "complete") {
        addLine(
          <span className="text-[hsl(var(--success))]">{"\u2713"} identity created</span>
        );
        addLine(
          <span className="text-[hsl(var(--text-secondary))] opacity-60">
            {"\u2192"} redirecting to /initialize...
          </span>
        );
        setStep("done");
        await signUp.finalize({ navigate: () => router.push("/initialize") });
        return;
      }

      // Email verification required
      if (
        signUp.status === "missing_requirements" &&
        signUp.unverifiedFields?.includes("email_address")
      ) {
        const sendResult = await signUp.verifications.sendEmailCode();
        if (sendResult.error) {
          addLine(
            <span className="text-[hsl(var(--accent))]">
              ERR: {sendResult.error.message}
            </span>
          );
          setStep("username");
          return;
        }
        addLine(
          <span className="text-[hsl(var(--success))]">{"\u2713"} account created</span>
        );
        addLine(
          <span className="text-[hsl(var(--text-secondary))] opacity-60">
            {"\u2192"} verification code sent to {email}
          </span>
        );
        addLine("\u00A0");
        setTimeout(() => setStep("verify"), 400);
      }
    } catch (err: unknown) {
      addLine(
        <span className="text-[hsl(var(--accent))]">
          ERR: {extractError(err)}
        </span>
      );
      addLine("\u00A0");
      setStep("email");
    }
  }, [email, password, signUp, router, addLine]);

  const handleVerify = useCallback(async (val: string) => {
    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">code:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">{val}</span>
      </span>
    );
    addLine("\u00A0");
    setStep("verifying");

    if (!signUp) return;

    addLine(
      <span className="text-[hsl(var(--text-secondary))] opacity-50">
        {"\u25CC"} verifying...
      </span>
    );

    try {
      const verifyResult = await signUp.verifications.verifyEmailCode({ code: val });

      if (verifyResult.error) {
        addLine(
          <span className="text-[hsl(var(--accent))]">
            ERR: {verifyResult.error.message ?? "invalid code."}
          </span>
        );
        addLine("\u00A0");
        setStep("verify");
        return;
      }

      if (signUp.status === "complete") {
        addLine(
          <span className="text-[hsl(var(--success))]">{"\u2713"} verified</span>
        );
        addLine(
          <span className="text-[hsl(var(--text-secondary))] opacity-60">
            {"\u2192"} redirecting to /initialize...
          </span>
        );
        setStep("done");
        await signUp.finalize({ navigate: () => router.push("/initialize") });
      } else {
        addLine(
          <span className="text-[hsl(var(--accent))]">
            ERR: verification incomplete. check your code.
          </span>
        );
        addLine("\u00A0");
        setStep("verify");
      }
    } catch (err: unknown) {
      addLine(
        <span className="text-[hsl(var(--accent))]">
          ERR: {extractError(err)}
        </span>
      );
      addLine("\u00A0");
      setStep("verify");
    }
  }, [signUp, router, addLine]);

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--bg))] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Terminal panel */}
        <div
          className="bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden"
          style={{ borderRadius: "8px" }}
        >
          <TerminalHeader title="you.md — initialize" />

          {/* Terminal body */}
          <div
            ref={scrollRef}
            className="p-6 md:p-8 min-h-[300px] max-h-[60dvh] overflow-y-auto font-mono text-[14px] leading-relaxed"
          >
            {/* Rendered lines */}
            {lines.map((line) => (
              <div key={line.id} className={line.className || ""}>
                {line.content || "\u00A0"}
              </div>
            ))}

            {/* Active input */}
            {step === "email" && (
              <div className="mt-2">
                <div className="text-[hsl(var(--text-secondary))] opacity-50 text-[13px] mb-1">
                  enter your email to begin
                </div>
                <TerminalAuthInput
                  prompt=">"
                  placeholder="email"
                  onSubmit={handleEmail}
                />
              </div>
            )}

            {step === "password" && (
              <div className="mt-2">
                <div className="text-[hsl(var(--text-secondary))] opacity-50 text-[13px] mb-1">
                  choose a password
                </div>
                <TerminalAuthInput
                  prompt=">"
                  type="password"
                  onSubmit={handlePassword}
                />
              </div>
            )}

            {step === "username" && (
              <div className="mt-2">
                <div className="text-[hsl(var(--text-secondary))] opacity-50 text-[13px] mb-1">
                  claim your username
                </div>
                <TerminalAuthInput
                  prompt=">"
                  placeholder="username"
                  onSubmit={handleUsername}
                />
              </div>
            )}

            {step === "verify" && (
              <div className="mt-2">
                <div className="text-[hsl(var(--text-secondary))] opacity-50 text-[13px] mb-1">
                  enter verification code
                </div>
                <TerminalAuthInput
                  prompt=">"
                  placeholder="000000"
                  onSubmit={handleVerify}
                />
              </div>
            )}

            {step === "verifying" && (
              <div className="text-[hsl(var(--accent-mid))] animate-pulse">
                {"\u25CC"} verifying...
              </div>
            )}
          </div>
        </div>

        {/* Link below terminal */}
        <div className="mt-4 text-center">
          <span className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-40">
            already initialized?{" "}
            <Link
              href="/sign-in"
              className="text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
            >
              sign in
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
