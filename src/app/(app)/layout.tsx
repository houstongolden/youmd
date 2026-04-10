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
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </MotionConfigProvider>
    </ConvexClientProvider>
  );
}
