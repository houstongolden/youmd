import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import { ConvexClientProvider } from "@/providers/convex-client-provider";
import { MotionConfigProvider } from "@/providers/motion-config-provider";
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
        {/* Cycle 71: purge any stale Service Worker that a previous
            deployment (or an extension) may have registered on you.md.
            We don't ship a Service Worker, so there should never be one.
            If one exists, it's a ghost from a broken state — unregister
            it unconditionally on every page load. Runs inline before React
            mounts so it takes effect even if hydration fails. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(regs){for(var i=0;i<regs.length;i++){regs[i].unregister();}}).catch(function(){});}if(typeof caches!=='undefined'&&caches.keys){caches.keys().then(function(ks){for(var j=0;j<ks.length;j++){caches.delete(ks[j]);}}).catch(function(){});}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${jetbrainsMono.variable} ${inter.variable} antialiased`}
      >
        {/* Cycle 71: noscript fallback. If JavaScript fails to load, is
            blocked by an extension, or the React bundle errors during
            hydration, users at least see a minimally useful page with
            the core brand, tagline, and a clear signal that JS is needed
            for the interactive experience. */}
        <noscript>
          <div
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#0D0D0D",
              color: "#EAE6E1",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              padding: "24px",
              zIndex: 9999,
              textAlign: "center",
            }}
          >
            <div style={{ maxWidth: "480px" }}>
              <div style={{ color: "#C46A3A", fontSize: "14px", marginBottom: "16px", letterSpacing: "0.1em" }}>
                you.md
              </div>
              <p style={{ fontSize: "13px", lineHeight: 1.6, marginBottom: "16px", opacity: 0.9 }}>
                identity context protocol for the agent internet
              </p>
              <p style={{ fontSize: "11px", lineHeight: 1.6, opacity: 0.5, marginBottom: "24px" }}>
                this page requires javascript to render its interactive shell.
                enable javascript and reload, or use the direct agent endpoints below.
              </p>
              <div style={{ fontSize: "11px", opacity: 0.7 }}>
                <a href="/houstongolden/you.json" style={{ color: "#C46A3A", display: "block", marginBottom: "6px" }}>
                  &gt; /houstongolden/you.json
                </a>
                <a href="/houstongolden/you.txt" style={{ color: "#C46A3A", display: "block", marginBottom: "6px" }}>
                  &gt; /houstongolden/you.txt
                </a>
                <a href="https://github.com/houstongolden/youmd" style={{ color: "#C46A3A", display: "block" }}>
                  &gt; github.com/houstongolden/youmd
                </a>
              </div>
            </div>
          </div>
        </noscript>
        <ConvexClientProvider>
          <MotionConfigProvider>
            <SiteNav />
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </MotionConfigProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
