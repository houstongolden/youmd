"use client";

import { RouteError } from "@/components/RouteError";

export default function DocsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} label="docs" />;
}
