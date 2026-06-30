"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { RealData } from "./realData";

type RealDataContextValue = {
  data: RealData | null;
  allowMockFallback: boolean;
};

const RealDataContext = createContext<RealDataContextValue>({
  data: null,
  allowMockFallback: true,
});

export function RealDataProvider({
  value,
  allowMockFallback = true,
  children,
}: {
  value: RealData | null;
  allowMockFallback?: boolean;
  children: ReactNode;
}) {
  return <RealDataContext.Provider value={{ data: value, allowMockFallback }}>{children}</RealDataContext.Provider>;
}

// Returns live local data when available, else null (views fall back to mock).
export function useRealData(): RealData | null {
  return useContext(RealDataContext).data;
}

export function useAllowMockFallback(): boolean {
  return useContext(RealDataContext).allowMockFallback;
}
