"use client";

import { useSignIn, useUser } from "@clerk/nextjs";
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
  const { isSignedIn } = useUser();
  const signInHook = useSignIn();
  const signIn = signInHook.signIn;
  const router = useRouter();

  // Redirect to dashboard if already signed in
  useEffect(() => {
    if (isSignedIn) router.replace("/shell");
  }, [isSignedIn, router]);

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
      setTimeout(() => addLine("enter your email.", "text-[hsl(var(--text-secondary))] opacity-70"), 1500),
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
    addLine("enter your password.", "text-[hsl(var(--text-secondary))] opacity-70");
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
        await signIn.finalize({ navigate: () => router.push("/shell") });
      } else if (signIn.status === "needs_first_factor" || signIn.status === "needs_second_factor") {
        // Email verification required — send code
        try {
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
            addLine("enter verification code.", "text-[hsl(var(--text-secondary))] opacity-70");
            setStep("verify");
          }
        } catch {
          // If emailCode.sendCode doesn't exist, try the prepare approach
          addLine(
            <span className="text-[hsl(var(--text-secondary))]">
              verification code sent to {email}
            </span>
          );
          addLine("\u00A0");
          addLine("enter verification code.", "text-[hsl(var(--text-secondary))] opacity-70");
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
        await signIn.finalize({ navigate: () => router.push("/shell") });
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

  const isInputStep = ["email", "password", "verify"].includes(step);

  const stepLabel: Record<string, string> = {
    email: "enter your email",
    password: "enter your password",
    verify: "enter verification code",
  };

  const stepPlaceholder: Record<string, string> = {
    email: "email",
    password: "",
    verify: "______",
  };

  const stepHandler: Record<string, (v: string) => void> = {
    email: handleEmail,
    password: handlePassword,
    verify: handleVerify,
  };

  // Per-step input semantics: type, autocomplete, mobile keyboard, accessible name
  const stepFieldConfig: Record<string, {
    type: "text" | "email" | "password" | "tel";
    autoComplete: string;
    inputMode?: "text" | "email" | "tel" | "url" | "numeric";
    name: string;
    ariaLabel: string;
  }> = {
    email: { type: "email", autoComplete: "email", inputMode: "email", name: "email", ariaLabel: "email address" },
    password: { type: "password", autoComplete: "current-password", name: "current-password", ariaLabel: "password" },
    verify: { type: "text", autoComplete: "one-time-code", inputMode: "numeric", name: "verification-code", ariaLabel: "verification code" },
  };

  return (
    <main className="h-[100dvh] bg-[hsl(var(--bg))] flex flex-col">
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 min-h-0">
        <div
          className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden min-h-0"
          style={{ borderRadius: "2px" }}
        >
          <TerminalHeader title="you.md — authenticate" asHeading />

          {/* Scrollable output */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 font-mono text-[14px] leading-relaxed"
          >
            {lines.map((line) => (
              <div key={line.id} className={line.className || ""}>
                {line.content || "\u00A0"}
              </div>
            ))}

            {(step === "authenticating" || step === "verifying") && (
              <div className="text-[hsl(var(--accent-mid))] animate-pulse mt-1">
                {"\u25CC"} {step === "authenticating" ? "authenticating" : "verifying"}...
              </div>
            )}
          </div>

          {/* Input pinned at bottom — clean, no labels */}
          {isInputStep && (
            <div className="shrink-0 border-t border-[hsl(var(--border))] px-5 pt-3 pb-5">
              <TerminalAuthInput
                prompt=">"
                placeholder={stepPlaceholder[step]}
                type={stepFieldConfig[step].type}
                autoComplete={stepFieldConfig[step].autoComplete}
                inputMode={stepFieldConfig[step].inputMode}
                name={stepFieldConfig[step].name}
                ariaLabel={stepFieldConfig[step].ariaLabel}
                onSubmit={stepHandler[step]}
              />
            </div>
          )}
        </div>

        {/* Links below terminal */}
        {!isInputStep && (
          <div className="mt-3 text-center shrink-0 flex flex-col gap-1">
            <span className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-40">
              need to initialize?{" "}
              <Link
                href="/sign-up"
                className="text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
              >
                sign up
              </Link>
            </span>
            <span className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-40">
              forgot password?{" "}
              <Link
                href="/reset-password"
                className="text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
              >
                reset
              </Link>
            </span>
          </div>
        )}
      </div>
    </main>
  );
}
