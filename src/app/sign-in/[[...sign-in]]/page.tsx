"use client";

import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import Link from "next/link";
import PixelYOU from "@/components/PixelYOU";

/* ── Types ─────────────────────────────────────────────────── */

type Step =
  | "email"
  | "password"
  | "authenticating"
  | "finalizing"
  | "done"
  | "error";

interface TermLine {
  type: "system" | "input" | "error" | "success" | "blank";
  text: string;
}

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

/* ── Main sign-in page ─────────────────────────────────────── */

export default function SignInPage() {
  const signInHook = useSignIn();
  const signIn = signInHook.signIn;
  const router = useRouter();

  const [bootDone, setBootDone] = useState(false);
  const [step, setStep] = useState<Step>("email");
  const [lines, setLines] = useState<TermLine[]>([]);
  const [input, setInput] = useState("");
  const [email, setEmail] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Boot sequence
  const bootLines = useTypewriter(
    [
      "you.md/v1 -- identity context protocol",
      "mcp for your identity",
      "",
      "auth sequence ready.",
      "",
    ],
    120,
    () => setBootDone(true)
  );

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, bootLines]);

  // Auto-focus
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
    password: "enter password",
  };

  const isInputStep = step === "email" || step === "password";

  const handleSubmit = useCallback(async () => {
    const value = input.trim();
    if (!value || !signIn) return;
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
        addLine({ type: "blank", text: "" });
        setStep("authenticating");
        addLine({ type: "system", text: "authenticating..." });

        try {
          const result = await signIn.password({
            identifier: email,
            password: value,
          });

          if (result.error) {
            addLines([
              { type: "error", text: `ERR: ${result.error.message ?? "authentication failed."}` },
              { type: "blank", text: "" },
            ]);
            setStep("email");
            return;
          }

          if (signIn.status === "complete") {
            addLines([
              { type: "success", text: "authenticated." },
              { type: "system", text: "loading session..." },
            ]);
            setStep("finalizing");
            const finalizeResult = await signIn.finalize({
              navigate: () => router.push("/dashboard"),
            });
            if (finalizeResult.error) {
              addLine({
                type: "error",
                text: `ERR: ${finalizeResult.error.message}`,
              });
              setStep("error");
            }
          } else {
            addLines([
              { type: "error", text: "authentication incomplete. additional steps required." },
              { type: "blank", text: "" },
            ]);
            setStep("email");
          }
        } catch (err: unknown) {
          addLines([
            { type: "error", text: `ERR: ${extractError(err)}` },
            { type: "blank", text: "" },
          ]);
          setStep("email");
        }
        break;
      }
    }
  }, [input, signIn, step, email, router, addLine, addLines]);

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
            need to initialize?
          </span>
          <Link
            href="/sign-up"
            className="text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-light))] transition-colors"
          >
            &gt; sign up
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
            auth.login
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
            {(step === "authenticating" || step === "finalizing") && (
              <p className="text-[hsl(var(--accent-mid))] animate-pulse pt-1">
                &gt;{" "}
                {step === "authenticating" ? "authenticating" : "loading session"}
                ...
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
                placeholder="_"
                autoComplete={
                  step === "email" ? "email" : "current-password"
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

  return (
    <p className={`font-mono text-[13px] leading-relaxed ${style}`}>
      &gt; {line.text}
    </p>
  );
}
