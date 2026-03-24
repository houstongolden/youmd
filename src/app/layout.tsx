import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import { ConvexClientProvider } from "@/providers/convex-client-provider";
import { SiteNav } from "@/components/SiteNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "you.md — Your identity file for the agent internet",
  description:
    "Claim your identity. Onboard any AI in seconds. The structured, portable identity bundle that gives every agent context about who you are.",
  openGraph: {
    title: "you.md — Identity as Code",
    description:
      "Your identity file for the agent internet. Onboard any AI in seconds.",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "you.md — Identity as Code",
    description:
      "Your identity file for the agent internet. Onboard any AI in seconds.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body
        className={`${jetbrainsMono.variable} ${inter.variable} antialiased`}
      >
        <ConvexClientProvider>
          <SiteNav />
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
