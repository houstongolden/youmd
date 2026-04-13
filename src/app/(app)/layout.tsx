import { ConvexClientProvider } from "@/providers/convex-client-provider";
import { MotionConfigProvider } from "@/providers/motion-config-provider";
import { SiteNav } from "@/components/SiteNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthGate } from "@/providers/auth-gate";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexClientProvider>
      <MotionConfigProvider>
        <SiteNav />
        <ErrorBoundary>
          <AuthGate>
            {children}
          </AuthGate>
        </ErrorBoundary>
      </MotionConfigProvider>
    </ConvexClientProvider>
  );
}
