"use client";

import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { TerminalAuthInput } from "@/components/terminal/TerminalAuthInput";

/* -- Clerk error extraction ----------------------------------------- */

function extractError(err: unknown): string {
  const clerkErr = err as {
    errors?: { message?: string; longMessage?: string }[];
    message?: string;
  };
  return (
    clerkErr.errors?.[0]?.longMessage ??
    clerkErr.errors?.[0]?.message ??
    clerkErr.message ??
    "password reset failed. try again."
  );
}

/* -- Main component ------------------------------------------------- */

type Step =
  | "boot"
  | "email"
  | "sending"
  | "code"
  | "verifying"
  | "new-password"
  | "confirm-password"
  | "submitting"
  | "done";

export default function ResetPasswordContent() {
  const signInHook = useSignIn();
  const signIn = signInHook.signIn;
  const router = useRouter();

  const [step, setStep] = useState<Step>("boot");
  const [lines, setLines] = useState<{ id: string; content: ReactNode; className?: string }[]>([]);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
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
      setTimeout(
        () =>
          addLine(
            "identity context protocol for the agent internet",
            "text-[hsl(var(--text-secondary))] opacity-60"
          ),
        600
      ),
      setTimeout(() => addLine("\u00A0"), 900),
      setTimeout(
        () =>
          addLine("initializing password reset...", "text-[hsl(var(--text-secondary))] opacity-50"),
        1100
      ),
      setTimeout(() => addLine("\u00A0"), 1400),
      setTimeout(
        () =>
          addLine(
            "enter the email associated with your account.",
            "text-[hsl(var(--text-secondary))] opacity-70"
          ),
        1500
      ),
      setTimeout(() => setStep("email"), 1600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [addLine]);

  /* Step 1: collect email, create sign-in, send reset code */
  const handleEmail = useCallback(
    async (val: string) => {
      setEmail(val);
      addLine(
        <span>
          <span className="text-[hsl(var(--accent))]">email:</span>{" "}
          <span className="text-[hsl(var(--text-secondary))]">{val}</span>
        </span>
      );
      addLine("\u00A0");
      setStep("sending");

      if (!signIn) return;

      addLine(
        <span className="text-[hsl(var(--text-secondary))] opacity-50">
          {"\u25CC"} sending reset code...
        </span>
      );

      try {
        // Create a sign-in attempt with the identifier
        const createResult = await signIn.create({ identifier: val });
        if (createResult.error) {
          addLine(
            <span className="text-[hsl(var(--accent))]">
              ERR: {createResult.error.message ?? "failed to find account."}
            </span>
          );
          addLine("\u00A0");
          addLine(
            "enter the email associated with your account.",
            "text-[hsl(var(--text-secondary))] opacity-70"
          );
          setStep("email");
          return;
        }

        // Send the password reset code
        const sendResult = await signIn.resetPasswordEmailCode.sendCode();
        if (sendResult.error) {
          addLine(
            <span className="text-[hsl(var(--accent))]">
              ERR: {sendResult.error.message ?? "failed to send reset code."}
            </span>
          );
          addLine("\u00A0");
          addLine(
            "enter the email associated with your account.",
            "text-[hsl(var(--text-secondary))] opacity-70"
          );
          setStep("email");
          return;
        }

        addLine(
          <span className="text-[hsl(var(--text-secondary))]">
            reset code sent to {val}
          </span>
        );
        addLine("\u00A0");
        addLine("enter the verification code.", "text-[hsl(var(--text-secondary))] opacity-70");
        setStep("code");
      } catch (err: unknown) {
        addLine(
          <span className="text-[hsl(var(--accent))]">ERR: {extractError(err)}</span>
        );
        addLine("\u00A0");
        addLine(
          "enter the email associated with your account.",
          "text-[hsl(var(--text-secondary))] opacity-70"
        );
        setStep("email");
      }
    },
    [signIn, addLine]
  );

  /* Step 2: verify the reset code */
  const handleCode = useCallback(
    async (code: string) => {
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
          {"\u25CC"} verifying code...
        </span>
      );

      try {
        const result = await signIn.resetPasswordEmailCode.verifyCode({ code });
        if (result.error) {
          addLine(
            <span className="text-[hsl(var(--accent))]">
              ERR: {result.error.message ?? "invalid code."}
            </span>
          );
          addLine("\u00A0");
          addLine(
            "enter the verification code.",
            "text-[hsl(var(--text-secondary))] opacity-70"
          );
          setStep("code");
          return;
        }

        addLine(
          <span className="text-[hsl(var(--success))]">{"\u2713"} code verified</span>
        );
        addLine("\u00A0");
        addLine("enter your new password.", "text-[hsl(var(--text-secondary))] opacity-70");
        setStep("new-password");
      } catch (err: unknown) {
        addLine(
          <span className="text-[hsl(var(--accent))]">ERR: {extractError(err)}</span>
        );
        addLine("\u00A0");
        addLine(
          "enter the verification code.",
          "text-[hsl(var(--text-secondary))] opacity-70"
        );
        setStep("code");
      }
    },
    [signIn, addLine]
  );

  /* Step 3: collect new password */
  const handleNewPassword = useCallback(
    (val: string) => {
      setNewPassword(val);
      addLine(
        <span>
          <span className="text-[hsl(var(--accent))]">password:</span>{" "}
          <span className="text-[hsl(var(--text-secondary))]">{"\u2022".repeat(val.length)}</span>
        </span>
      );
      addLine("\u00A0");
      addLine("confirm your new password.", "text-[hsl(var(--text-secondary))] opacity-70");
      setTimeout(() => setStep("confirm-password"), 300);
    },
    [addLine]
  );

  /* Step 4: confirm password and submit */
  const handleConfirmPassword = useCallback(
    async (val: string) => {
      addLine(
        <span>
          <span className="text-[hsl(var(--accent))]">confirm:</span>{" "}
          <span className="text-[hsl(var(--text-secondary))]">{"\u2022".repeat(val.length)}</span>
        </span>
      );
      addLine("\u00A0");

      if (val !== newPassword) {
        addLine(
          <span className="text-[hsl(var(--accent))]">ERR: passwords do not match.</span>
        );
        addLine("\u00A0");
        addLine("enter your new password.", "text-[hsl(var(--text-secondary))] opacity-70");
        setNewPassword("");
        setStep("new-password");
        return;
      }

      setStep("submitting");

      if (!signIn) return;

      addLine(
        <span className="text-[hsl(var(--text-secondary))] opacity-50">
          {"\u25CC"} updating password...
        </span>
      );

      try {
        const result = await signIn.resetPasswordEmailCode.submitPassword({
          password: val,
          signOutOfOtherSessions: true,
        });

        if (result.error) {
          addLine(
            <span className="text-[hsl(var(--accent))]">
              ERR: {result.error.message ?? "failed to reset password."}
            </span>
          );
          addLine("\u00A0");
          addLine("enter your new password.", "text-[hsl(var(--text-secondary))] opacity-70");
          setNewPassword("");
          setStep("new-password");
          return;
        }

        addLine(
          <span className="text-[hsl(var(--success))]">{"\u2713"} password updated</span>
        );
        addLine("\u00A0");
        addLine(
          <span className="text-[hsl(var(--text-secondary))] opacity-60">
            {"\u2192"} redirecting to sign in...
          </span>
        );
        setStep("done");

        // If the sign-in is complete, finalize and go to dashboard
        if (signIn.status === "complete") {
          await signIn.finalize({ navigate: () => router.push("/dashboard") });
        } else {
          // Otherwise redirect to sign-in so they can log in with new password
          setTimeout(() => router.push("/sign-in"), 1500);
        }
      } catch (err: unknown) {
        addLine(
          <span className="text-[hsl(var(--accent))]">ERR: {extractError(err)}</span>
        );
        addLine("\u00A0");
        addLine("enter your new password.", "text-[hsl(var(--text-secondary))] opacity-70");
        setNewPassword("");
        setStep("new-password");
      }
    },
    [newPassword, signIn, router, addLine]
  );

  const isInputStep = ["email", "code", "new-password", "confirm-password"].includes(step);

  const stepPlaceholder: Record<string, string> = {
    email: "email",
    code: "______",
    "new-password": "",
    "confirm-password": "",
  };

  const stepHandler: Record<string, (v: string) => void> = {
    email: handleEmail,
    code: handleCode,
    "new-password": handleNewPassword,
    "confirm-password": handleConfirmPassword,
  };

  const stepType: Record<string, "text" | "password"> = {
    email: "text",
    code: "text",
    "new-password": "password",
    "confirm-password": "password",
  };

  const spinnerStep =
    step === "sending"
      ? "sending reset code"
      : step === "verifying"
        ? "verifying"
        : step === "submitting"
          ? "updating password"
          : null;

  return (
    <div className="h-[100dvh] bg-[hsl(var(--bg))] flex flex-col">
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 min-h-0">
        <div
          className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden min-h-0"
          style={{ borderRadius: "2px" }}
        >
          <TerminalHeader title="you.md -- reset password" />

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

            {spinnerStep && (
              <div className="text-[hsl(var(--accent-mid))] animate-pulse mt-1">
                {"\u25CC"} {spinnerStep}...
              </div>
            )}
          </div>

          {/* Input pinned at bottom */}
          {isInputStep && (
            <div className="shrink-0 border-t border-[hsl(var(--border))] px-5 pt-3 pb-5">
              <TerminalAuthInput
                prompt=">"
                placeholder={stepPlaceholder[step]}
                type={stepType[step]}
                onSubmit={stepHandler[step]}
              />
            </div>
          )}
        </div>

        {/* Links below terminal */}
        <div className="mt-3 text-center shrink-0">
          <span className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-40">
            remember your password?{" "}
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
