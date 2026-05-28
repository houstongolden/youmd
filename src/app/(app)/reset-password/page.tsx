import type { Metadata } from "next";
import ResetPasswordContent from "./reset-content";

export const metadata: Metadata = {
  title: "Reset Password — you.md",
  description: "Reset your you.md password and regain access to your agent brain.",
  openGraph: {
    title: "Reset Password — you.md",
    description: "Reset your you.md password and regain access to your agent brain.",
    url: "https://you.md/reset-password",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reset Password — you.md",
    description: "Reset your you.md password and regain access to your agent brain.",
  },
};

export default function ResetPasswordPage() {
  return <ResetPasswordContent />;
}
