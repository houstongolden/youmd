import { ConvexClientProvider } from "@/providers/convex-client-provider";
import { MotionConfigProvider } from "@/providers/motion-config-provider";
import { SiteNav } from "@/components/SiteNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexClientProvider>
      <MotionConfigProvider>
        <SiteNav />
        {/* Skip-link target — pages render their own <main> landmark inside;
            tabIndex={-1} makes the anchor focusable for the skip link. */}
        <div id="main" tabIndex={-1} className="focus:outline-none">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </MotionConfigProvider>
    </ConvexClientProvider>
  );
}
