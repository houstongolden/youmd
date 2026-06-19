"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon, type IconName } from "./icons";

type Toast = { id: number; text: string; icon: IconName };
type Push = (text: string, icon?: IconName) => void;

const ToastCtx = createContext<Push>(() => {});
export const useToast = (): Push => useContext(ToastCtx);

// Minimal toast stack for action feedback ("task created", "spawning…").
// Bottom-right, auto-dismiss, motion in/out. Self-contained to the demo.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback<Push>((text, icon = "sparkles") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="pointer-events-auto flex items-center gap-2.5 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-3.5 py-2.5 text-[13px] text-[hsl(var(--text-primary))] shadow-2xl"
            >
              <Icon name={t.icon} size={14} className="text-[hsl(var(--accent))]" />
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
