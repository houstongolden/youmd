"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { RealData } from "./realData";

const RealDataContext = createContext<RealData | null>(null);

export function RealDataProvider({ value, children }: { value: RealData | null; children: ReactNode }) {
  return <RealDataContext.Provider value={value}>{children}</RealDataContext.Provider>;
}

// Returns live local data when available, else null (views fall back to mock).
export function useRealData(): RealData | null {
  return useContext(RealDataContext);
}
