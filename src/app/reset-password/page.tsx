import type { Metadata } from "next";
import ResetPasswordContent from "./reset-content";

export const metadata: Metadata = {
  title: "Reset Password — you.md",
  description: "Reset your you.md password and regain access to your identity file.",
  openGraph: {
    title: "Reset Password — you.md",
    description: "Reset your you.md password and regain access to your identity file.",
    url: "https://you.md/reset-password",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reset Password — you.md",
    description: "Reset your you.md password and regain access to your identity file.",
  },
};

export default function ResetPasswordPage() {
  return <ResetPasswordContent />;
}
