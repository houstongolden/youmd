import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const fieldControlClasses =
  "w-full rounded-[2px] border border-border bg-background px-3 font-mono text-[13px] text-foreground transition-colors placeholder:text-muted-foreground/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40";

export function Label({
  className,
  ...props
}: ComponentPropsWithoutRef<"label">) {
  return (
    <label
      className={cn("font-mono text-[12px] leading-none text-muted-foreground/75", className)}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldControlClasses, "h-11", className)} {...props} />;
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<"textarea">>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(fieldControlClasses, "min-h-24 resize-y py-3 leading-[1.55]", className)}
        {...props}
      />
    );
  }
);

export const Select = forwardRef<HTMLSelectElement, ComponentPropsWithoutRef<"select">>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(fieldControlClasses, "h-11", className)} {...props} />;
  }
);

export function FieldHelp({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-[12px] leading-relaxed text-muted-foreground/55", className)}>
      {children}
    </p>
  );
}

export function FieldError({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-[12px] leading-relaxed text-accent", className)}>
      {children}
    </p>
  );
}

export function FormField({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}
