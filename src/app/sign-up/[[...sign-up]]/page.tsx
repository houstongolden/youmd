"use client";

import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import Link from "next/link";
import PixelYOU from "@/components/PixelYOU";

/* ── Types ─────────────────────────────────────────────────── */

type Step =
  | "email"
  | "password"
  | "username"
  | "processing"
  | "verify"
  | "verifying"
  | "finalizing"
  | "done"
  | "error";

interface TermLine {
  type: "system" | "input" | "error" | "success" | "blank";
  text: string;
}

/* ── Clerk error extraction ────────────────────────────────── */

function extractError(err: unknown): {
  message: string;
  param?: string;
} {
  const clerkErr = err as {
    errors?: {
      message?: string;
      longMessage?: string;
      meta?: { paramName?: string };
    }[];
    message?: string;
  };
  return {
    message:
      clerkErr.errors?.[0]?.longMessage ??
      clerkErr.errors?.[0]?.message ??
      clerkErr.message ??
      "initialization failed. try again.",
    param: clerkErr.errors?.[0]?.meta?.paramName,
  };
}

/* ── Typewriter helper ─────────────────────────────────────── */

function useTypewriter(
  lines: string[],
  delay: number,
  onDone: () => void
) {
  const [displayed, setDisplayed] = useState<string[]>([]);
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    let i = 0;
    const interval = setInterval(() => {
      if (i < lines.length) {
        setDisplayed((prev) => [...prev, lines[i]]);
        i++;
      } else {
        clearInterval(interval);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      }
    }, delay);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return displayed;
}

/* ── Main sign-up page ─────────────────────────────────────── */

export default function SignUpPage() {
  const signUpHook = useSignUp();
  const signUp = signUpHook.signUp;
  const router = useRouter();

  const [bootDone, setBootDone] = useState(false);
  const [step, setStep] = useState<Step>("email");
  const [lines, setLines] = useState<TermLine[]>([]);
  const [input, setInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Boot sequence
  const bootLines = useTypewriter(
    [
      "you.md/v1 -- identity context protocol",
      "mcp for your identity",
      "",
      "initializing auth sequence...",
      "ready.",
      "",
    ],
    120,
    () => setBootDone(true)
  );

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, bootLines]);

  // Auto-focus input when step changes
  useEffect(() => {
    if (bootDone) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [step, bootDone]);

  const addLine = useCallback((line: TermLine) => {
    setLines((prev) => [...prev, line]);
  }, []);

  const addLines = useCallback((newLines: TermLine[]) => {
    setLines((prev) => [...prev, ...newLines]);
  }, []);

  const promptLabel: Record<string, string> = {
    email: "enter email",
    password: "choose password",
    username: "claim username",
    verify: "enter verification code",
  };

  const isInputStep = ["email", "password", "username", "verify"].includes(step);

  const handleSubmit = useCallback(async () => {
    const value = input.trim();
    if (!value || !signUp) return;
    setInput("");

    switch (step) {
      case "email": {
        addLine({ type: "input", text: value });
        setEmail(value);
        addLine({ type: "blank", text: "" });
        setStep("password");
        break;
      }
      case "password": {
        addLine({ type: "input", text: "*".repeat(value.length) });
        setPassword(value);
        addLine({ type: "blank", text: "" });
        setStep("username");
        break;
      }
      case "username": {
        addLine({ type: "input", text: value });
        addLine({ type: "blank", text: "" });
        setStep("processing");

        addLine({ type: "system", text: "initializing identity bundle..." });

        try {
          const result = await signUp.password({
            emailAddress: email,
            password,
            username: value,
          });

          if (result.error) {
            addLines([
              { type: "error", text: `ERR: ${result.error.message ?? "initialization failed."}` },
              { type: "blank", text: "" },
            ]);
            setStep("username");
            return;
          }

          if (signUp.status === "complete") {
            addLine({ type: "success", text: "identity created." });
            addLine({ type: "system", text: "finalizing session..." });
            setStep("finalizing");
            const finalizeResult = await signUp.finalize({
              navigate: () => router.push("/initialize"),
            });
            if (finalizeResult.error) {
              addLine({ type: "error", text: `ERR: ${finalizeResult.error.message}` });
              setStep("error");
            }
            return;
          }

          // Email verification required
          if (
            signUp.status === "missing_requirements" &&
            signUp.unverifiedFields?.includes("email_address")
          ) {
            const sendResult = await signUp.verifications.sendEmailCode();
            if (sendResult.error) {
              addLine({ type: "error", text: `ERR: ${sendResult.error.message}` });
              setStep("error");
              return;
            }
            addLines([
              { type: "success", text: "account created." },
              { type: "system", text: `verification code sent to ${email}` },
              { type: "blank", text: "" },
            ]);
            setStep("verify");
          }
        } catch (err: unknown) {
          const { message, param } = extractError(err);
          addLines([
            { type: "error", text: `ERR: ${message}` },
            { type: "blank", text: "" },
          ]);
          // Restart from the problematic field
          if (param === "username") setStep("username");
          else if (param === "password") setStep("password");
          else setStep("email");
        }
        break;
      }
      case "verify": {
        addLine({ type: "input", text: value });
        addLine({ type: "blank", text: "" });
        setStep("verifying");
        addLine({ type: "system", text: "verifying..." });

        try {
          const verifyResult = await signUp.verifications.verifyEmailCode({
            code: value,
          });

          if (verifyResult.error) {
            addLines([
              { type: "error", text: `ERR: ${verifyResult.error.message ?? "invalid code."}` },
              { type: "blank", text: "" },
            ]);
            setStep("verify");
            return;
          }

          if (signUp.status === "complete") {
            addLine({ type: "success", text: "verified." });
            addLine({ type: "system", text: "initializing session..." });
            setStep("finalizing");
            const finalizeResult = await signUp.finalize({
              navigate: () => router.push("/initialize"),
            });
            if (finalizeResult.error) {
              addLine({ type: "error", text: `ERR: ${finalizeResult.error.message}` });
              setStep("error");
            }
          } else {
            addLines([
              { type: "error", text: "verification incomplete. check your code." },
              { type: "blank", text: "" },
            ]);
            setStep("verify");
          }
        } catch (err: unknown) {
          addLines([
            { type: "error", text: `ERR: ${extractError(err).message}` },
            { type: "blank", text: "" },
          ]);
          setStep("verify");
        }
        break;
      }
    }
  }, [input, signUp, step, email, password, router, addLine, addLines]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--bg))] flex flex-col">
      {/* Nav bar */}
      <nav className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border))] shrink-0">
        <Link href="/" className="inline-block">
          <PixelYOU />
        </Link>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-[hsl(var(--text-secondary))] opacity-50">
            already initialized?
          </span>
          <Link
            href="/sign-in"
            className="text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-light))] transition-colors"
          >
            &gt; sign in
          </Link>
        </div>
      </nav>

      {/* Terminal body */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
        {/* Terminal header with dots */}
        <div className="terminal-panel-header">
          <div className="terminal-dot" />
          <div className="terminal-dot" />
          <div className="terminal-dot" />
          <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 ml-2">
            auth.init
          </span>
        </div>

        {/* Scrollable terminal output */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-0.5 font-mono text-[13px]">
            {/* Boot sequence */}
            {bootLines.map((text, i) =>
              text === "" ? (
                <div key={`boot-${i}`} className="h-3" />
              ) : (
                <p
                  key={`boot-${i}`}
                  className="text-[hsl(var(--text-secondary))] opacity-60 leading-relaxed"
                >
                  {text}
                </p>
              )
            )}

            {/* Interactive lines */}
            {lines.map((line, i) => (
              <LineRenderer key={`line-${i}`} line={line} />
            ))}

            {/* Current prompt label */}
            {bootDone && isInputStep && (
              <div className="pt-1">
                <span className="text-[hsl(var(--text-secondary))] opacity-50 text-[11px]">
                  $ {promptLabel[step]}
                </span>
              </div>
            )}

            {/* Processing indicator */}
            {(step === "processing" || step === "verifying" || step === "finalizing") && (
              <p className="text-[hsl(var(--accent-mid))] animate-pulse pt-1">
                &gt; {step === "processing" ? "processing" : step === "verifying" ? "verifying" : "finalizing"}...
              </p>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input area */}
        {bootDone && isInputStep && (
          <div className="shrink-0 border-t border-[hsl(var(--border))] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[hsl(var(--accent))] font-mono text-[13px] select-none">
                &gt;
              </span>
              <input
                ref={inputRef}
                type={step === "password" ? "password" : "text"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={step === "verify" ? "______" : "_"}
                autoComplete={
                  step === "email"
                    ? "email"
                    : step === "password"
                      ? "new-password"
                      : step === "username"
                        ? "username"
                        : "one-time-code"
                }
                className="flex-1 bg-transparent border-none outline-none font-mono text-[13px] text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-secondary))]/15"
                autoFocus
              />
              <span className="text-[9px] font-mono text-[hsl(var(--text-secondary))] opacity-25 uppercase tracking-widest">
                enter
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Line renderer ─────────────────────────────────────────── */

function LineRenderer({ line }: { line: TermLine }) {
  if (line.type === "blank") return <div className="h-3" />;

  const style = {
    system: "text-[hsl(var(--text-secondary))] opacity-60",
    input: "text-[hsl(var(--text-primary))]",
    error: "text-[hsl(var(--accent))]",
    success: "text-[hsl(var(--success))]",
    blank: "",
  }[line.type];

  const prefix = line.type === "input" ? "> " : "> ";

  return (
    <p className={`font-mono text-[13px] leading-relaxed ${style}`}>
      {prefix}
      {line.text}
    </p>
  );
}
