import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative bg-[hsl(var(--bg))] overflow-hidden">
      {/* Subtle beam background */}
      <div className="absolute inset-0 beam-glow pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center space-y-8 w-full max-w-md px-6 animate-fade-in">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <Link
            href="/"
            className="font-mono text-2xl tracking-tight text-[hsl(var(--text-primary))] hover:text-[hsl(var(--accent))] transition-colors"
          >
            you.md
          </Link>
          <p className="text-[hsl(var(--text-secondary))] text-xs font-mono tracking-wide">
            identity context protocol
          </p>
        </div>

        {/* Clerk sign-in */}
        <SignIn
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "terminal-panel shadow-xl",
              headerTitle: "text-[hsl(var(--text-primary))] font-mono",
              headerSubtitle: "text-[hsl(var(--text-secondary))]",
              socialButtonsBlockButton:
                "border-[hsl(var(--border))] bg-[hsl(var(--bg))] hover:bg-[hsl(var(--bg-raised))] text-[hsl(var(--text-primary))]",
              formButtonPrimary:
                "bg-[hsl(var(--accent))] hover:bg-[hsl(var(--accent-dark))] text-white",
              formFieldInput:
                "bg-[hsl(var(--bg))] border-[hsl(var(--border))] text-[hsl(var(--text-primary))] focus:border-[hsl(var(--accent))]",
              formFieldLabel: "text-[hsl(var(--text-secondary))] font-mono text-xs",
              footerActionLink:
                "text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-light))]",
              identityPreviewText: "text-[hsl(var(--text-primary))]",
              identityPreviewEditButton: "text-[hsl(var(--accent))]",
            },
            variables: {
              colorPrimary: "#C46A3A",
              colorText: "#EAE6E1",
              colorBackground: "#171717",
              colorInputBackground: "#0D0D0D",
              colorInputText: "#EAE6E1",
              borderRadius: "0.25rem",
            },
          }}
          fallbackRedirectUrl="/dashboard"
        />

        {/* Sign-up link */}
        <p className="text-xs text-[hsl(var(--text-secondary))] font-mono">
          no account?{" "}
          <Link
            href="/sign-up"
            className="text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-light))] transition-colors"
          >
            sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
