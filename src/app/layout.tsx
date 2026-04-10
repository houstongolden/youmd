import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
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
  title: "you.md — Identity context protocol for the agent internet",
  description:
    "An MCP where the context is you. The identity protocol that gives every AI agent full context about who you are — zero-setup onboarding across every tool.",
  openGraph: {
    title: "you.md — Identity Context Protocol",
    description:
      "An MCP where the context is you. Zero-setup agent onboarding across every tool.",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "you.md — Identity Context Protocol",
    description:
      "An MCP where the context is you. Zero-setup agent onboarding across every tool.",
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(regs){for(var i=0;i<regs.length;i++){regs[i].unregister();}}).catch(function(){});}if(typeof caches!=='undefined'&&caches.keys){caches.keys().then(function(ks){for(var j=0;j<ks.length;j++){caches.delete(ks[j]);}}).catch(function(){});}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${jetbrainsMono.variable} ${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
