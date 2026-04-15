import { ConvexClientProvider } from "@/providers/convex-client-provider";
import { MotionConfigProvider } from "@/providers/motion-config-provider";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexClientProvider>
      <MotionConfigProvider>
        {children}
      </MotionConfigProvider>
    </ConvexClientProvider>
  );
}
