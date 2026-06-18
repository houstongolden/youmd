// Standalone full-viewport shell for the native-desktop-app demo.
// Intentionally NO SiteNav / marketing chrome and NO Convex provider — the
// demo is a non-functional design surface (frontend only) so we keep it
// completely self-contained and app-like. Fonts + theme come from the root
// layout (src/app/layout.tsx).
export default function DesktopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]">
      {children}
    </div>
  );
}
