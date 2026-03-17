import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative bg-background overflow-hidden">
      {/* Beam-glow background effect */}
      <div className="absolute inset-0 beam-glow pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-coral/[0.04] blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center space-y-8 w-full max-w-md px-6 animate-fade-in">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <Link href="/" className="font-mono text-3xl tracking-tight text-foreground hover:text-coral transition-colors">
            you.md
          </Link>
          <p className="text-foreground-secondary text-sm tracking-wide">
            Your identity on the agent internet.
          </p>
        </div>

        {/* Clerk sign-in component */}
        <SignIn
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-background-secondary border border-border shadow-xl rounded-xl",
              headerTitle: "text-foreground font-semibold",
              headerSubtitle: "text-foreground-secondary",
              socialButtonsBlockButton: "border-border bg-background hover:bg-background-secondary",
              formButtonPrimary: "bg-coral hover:bg-blush text-void",
              formFieldInput: "bg-background border-border text-foreground focus:border-sky",
              formFieldLabel: "text-foreground-secondary",
              footerActionLink: "text-sky hover:text-coral",
              identityPreviewText: "text-foreground",
              identityPreviewEditButton: "text-sky",
            },
            variables: {
              colorPrimary: "#E8857A",
              colorText: "var(--foreground)",
              colorBackground: "var(--background-secondary)",
              colorInputBackground: "var(--background)",
              colorInputText: "var(--foreground)",
              borderRadius: "0.5rem",
            },
          }}
          fallbackRedirectUrl="/dashboard"
        />

        {/* Sign-up link */}
        <p className="text-sm text-foreground-secondary">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-sky hover:text-coral transition-colors font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
