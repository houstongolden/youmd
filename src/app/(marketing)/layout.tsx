import { MotionConfigProvider } from "@/providers/motion-config-provider";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <MotionConfigProvider>
      {children}
    </MotionConfigProvider>
  );
}
