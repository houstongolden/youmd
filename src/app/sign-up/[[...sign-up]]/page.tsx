"use client";

import { useSignUp, useUser } from "@clerk/nextjs";
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
  const { isSignedIn } = useUser();
  const signUpHook = useSignUp();
  const signUp = signUpHook.signUp;
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) router.replace("/shell");
  }, [isSignedIn, router]);

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
      setTimeout(() => addLine("enter your email to begin.", "text-[hsl(var(--text-secondary))] opacity-70"), 1500),
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
    addLine("choose a password.", "text-[hsl(var(--text-secondary))] opacity-70");
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
    addLine("claim your username.", "text-[hsl(var(--text-secondary))] opacity-70");
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

    // Check username availability — skip HTTP endpoint (caching issues), just proceed
    // Clerk will validate the username, and createUser will check both tables
    addLine("checking username availability...", "text-[hsl(var(--text-secondary))] opacity-50");

    addLine("initializing identity context...", "text-[hsl(var(--text-secondary))] opacity-50");

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
        addLine("enter verification code.", "text-[hsl(var(--text-secondary))] opacity-70");
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

  const isInputStep = ["email", "password", "username", "verify"].includes(step);

  const stepLabel: Record<string, string> = {
    email: "enter your email to begin",
    password: "choose a password",
    username: "claim your username",
    verify: "enter verification code",
  };

  const stepPlaceholder: Record<string, string> = {
    email: "email",
    password: "",
    username: "username",
    verify: "000000",
  };

  const stepHandler: Record<string, (v: string) => void> = {
    email: handleEmail,
    password: handlePassword,
    username: handleUsername,
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
    password: { type: "password", autoComplete: "new-password", name: "new-password", ariaLabel: "new password" },
    username: { type: "text", autoComplete: "username", name: "username", ariaLabel: "username" },
    verify: { type: "text", autoComplete: "one-time-code", inputMode: "numeric", name: "verification-code", ariaLabel: "verification code" },
  };

  return (
    <main className="h-[100dvh] bg-[hsl(var(--bg))] flex flex-col">
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 min-h-0">
        <div
          className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden min-h-0"
          style={{ borderRadius: "2px" }}
        >
          <TerminalHeader title="you.md — initialize" asHeading />

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

            {step === "processing" && (
              <div className="text-[hsl(var(--accent-mid))] animate-pulse mt-1">
                {"\u25CC"} processing...
              </div>
            )}
            {step === "verifying" && (
              <div className="text-[hsl(var(--accent-mid))] animate-pulse mt-1">
                {"\u25CC"} verifying...
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

        {/* Link below terminal */}
        {!isInputStep && (
          <div className="mt-3 text-center shrink-0">
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
        )}
      </div>
    </main>
  );
}
