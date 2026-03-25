import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — you.md",
  description:
    "Authenticate to your you.md identity file. Access and manage your profile for the agent internet.",
  openGraph: {
    title: "Sign In — you.md",
    description:
      "Authenticate to your you.md identity file. Access and manage your profile for the agent internet.",
    url: "https://you.md/sign-in",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign In — you.md",
    description:
      "Authenticate to your you.md identity file. Access and manage your profile for the agent internet.",
  },
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
