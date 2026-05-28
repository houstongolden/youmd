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
  title: "you.md — Agent brain and expertise stacks for the agent internet",
  description:
    "Your durable agent brain, named expertise stacks, local runtime, and protected API/MCP layer for Claude Code, Codex, Cursor, and every AI tool you use.",
  openGraph: {
    title: "you.md — Agent Brain + Expertise Stacks",
    description:
      "Build your agent brain once. Package your skills and workflows into portable YouStacks that work across every AI tool.",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "you.md — Agent Brain + Expertise Stacks",
    description:
      "A durable personal brain plus named expertise stacks for the agents you already use.",
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
