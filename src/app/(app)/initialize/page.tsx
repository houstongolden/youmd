import type { Metadata } from "next";
import { InitializeContent } from "./initialize-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Initialize — you.md",
  description:
    "Set up your you.md agent brain, runtime, and private-by-default expertise stacks.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function InitializePage() {
  return <InitializeContent />;
}
