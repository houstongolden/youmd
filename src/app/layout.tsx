import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Pre-hydration theme bootstrap — dark is the default; ThemeToggle persists
// "theme" in localStorage ("light" | "dark" | "system") and toggles the
// .light class on <html>. Applying it synchronously before first paint
// prevents a dark→light flash for light/system-light users.
// Constant string, no interpolation — XSS-safe by construction.
const THEME_INIT_SCRIPT =
  '(function(){try{var t=localStorage.getItem("theme");if(t==="light"||(t==="system"&&!window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("light")}}catch(e){}})();';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable}`}
      // The theme script below may add .light before hydration — expected mismatch
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(regs){for(var i=0;i<regs.length;i++){regs[i].unregister();}}).catch(function(){});}if(typeof caches!=='undefined'&&caches.keys){caches.keys().then(function(ks){for(var j=0;j<ks.length;j++){caches.delete(ks[j]);}}).catch(function(){});}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
