import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up — you.md",
  description:
    "Create your identity context for the agent internet. Claim a username and let every AI know who you are.",
  openGraph: {
    title: "Sign Up — you.md",
    description:
      "Create your identity context for the agent internet. Claim a username and let every AI know who you are.",
    url: "https://you.md/sign-up",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign Up — you.md",
    description:
      "Create your identity context for the agent internet. Claim a username and let every AI know who you are.",
  },
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
