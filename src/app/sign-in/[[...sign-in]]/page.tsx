"use client";

import { useSignIn } from "@clerk/nextjs";
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
    "authentication failed. try again."
  );
}

/* ── Main page ─────────────────────────────────────────────── */

type Step = "boot" | "email" | "password" | "authenticating" | "verify" | "verifying" | "done";

export default function SignInPage() {
  const signInHook = useSignIn();
  const signIn = signInHook.signIn;
  const router = useRouter();

  const [step, setStep] = useState<Step>("boot");
  const [lines, setLines] = useState<{ id: string; content: ReactNode; className?: string }[]>([]);
  const [email, setEmail] = useState("");
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

  const handlePassword = useCallback(async (val: string) => {
    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">password:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">{"\u2022".repeat(val.length)}</span>
      </span>
    );
    addLine("\u00A0");
    setStep("authenticating");

    if (!signIn) return;

    addLine(
      <span className="text-[hsl(var(--text-secondary))] opacity-50">
        {"\u25CC"} authenticating...
      </span>
    );

    try {
      const result = await signIn.password({
        identifier: email,
        password: val,
      });

      if (result.error) {
        addLine(
          <span className="text-[hsl(var(--accent))]">
            ERR: {result.error.message ?? "authentication failed."}
          </span>
        );
        addLine("\u00A0");
        setStep("email");
        return;
      }

      if (signIn.status === "complete") {
        addLine(
          <span className="text-[hsl(var(--success))]">{"\u2713"} authenticated</span>
        );
        addLine(
          <span className="text-[hsl(var(--text-secondary))] opacity-60">
            {"\u2192"} redirecting to dashboard...
          </span>
        );
        setStep("done");
        await signIn.finalize({ navigate: () => router.push("/dashboard") });
      } else if (signIn.status === "needs_first_factor") {
        // Email verification required — send code via v7 API
        const sendResult = await signIn.emailCode.sendCode({ emailAddress: email });
        if (sendResult.error) {
          addLine(
            <span className="text-[hsl(var(--accent))]">
              ERR: {sendResult.error.message ?? "failed to send verification code."}
            </span>
          );
          addLine("\u00A0");
          setStep("email");
        } else {
          addLine(
            <span className="text-[hsl(var(--text-secondary))]">
              verification code sent to {email}
            </span>
          );
          addLine("\u00A0");
          setStep("verify");
        }
      } else {
        addLine(
          <span className="text-[hsl(var(--accent))]">
            ERR: authentication incomplete ({signIn.status}). try again or sign up.
          </span>
        );
        addLine("\u00A0");
        setStep("email");
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
  }, [email, signIn, router, addLine]);

  const handleVerify = useCallback(async (code: string) => {
    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">code:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">{code}</span>
      </span>
    );
    addLine("\u00A0");
    setStep("verifying");

    if (!signIn) return;

    addLine(
      <span className="text-[hsl(var(--text-secondary))] opacity-50">
        {"\u25CC"} verifying...
      </span>
    );

    try {
      const result = await signIn.emailCode.verifyCode({ code });

      if (result.error) {
        addLine(
          <span className="text-[hsl(var(--accent))]">
            ERR: {result.error.message ?? "invalid code."}
          </span>
        );
        addLine("\u00A0");
        setStep("verify");
        return;
      }

      if (signIn.status === "complete") {
        addLine(
          <span className="text-[hsl(var(--success))]">{"\u2713"} verified</span>
        );
        addLine(
          <span className="text-[hsl(var(--text-secondary))] opacity-60">
            {"\u2192"} redirecting to dashboard...
          </span>
        );
        setStep("done");
        await signIn.finalize({ navigate: () => router.push("/dashboard") });
      } else {
        addLine(
          <span className="text-[hsl(var(--accent))]">
            ERR: verification incomplete. try again.
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
  }, [signIn, router, addLine]);

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--bg))] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Terminal panel */}
        <div
          className="bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden"
          style={{ borderRadius: "8px" }}
        >
          <TerminalHeader title="you.md — authenticate" />

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
                  enter your email
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
                  enter your password
                </div>
                <TerminalAuthInput
                  prompt=">"
                  type="password"
                  onSubmit={handlePassword}
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
                  placeholder="______"
                  onSubmit={handleVerify}
                />
              </div>
            )}

            {(step === "authenticating" || step === "verifying") && (
              <div className="text-[hsl(var(--accent-mid))] animate-pulse">
                {"\u25CC"} {step === "authenticating" ? "authenticating" : "verifying"}...
              </div>
            )}
          </div>
        </div>

        {/* Link below terminal */}
        <div className="mt-4 text-center">
          <span className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-40">
            need to initialize?{" "}
            <Link
              href="/sign-up"
              className="text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
            >
              sign up
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
