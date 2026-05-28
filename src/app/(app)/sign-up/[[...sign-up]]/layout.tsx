import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up — you.md",
  description:
    "Create your agent brain for the agent internet. Claim a username, keep stacks private by default, and let trusted AI tools know how you work.",
  openGraph: {
    title: "Sign Up — you.md",
    description:
      "Create your durable agent brain and private-by-default expertise stacks.",
    url: "https://you.md/sign-up",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign Up — you.md",
    description:
      "Create your durable agent brain and portable expertise stacks.",
  },
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
