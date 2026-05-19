import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "link" | "terminal-link";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-accent bg-accent text-white hover:bg-accent-dark hover:border-accent-dark active:translate-y-px disabled:hover:bg-accent",
  secondary:
    "border-border bg-card text-foreground/85 hover:border-accent/45 hover:text-foreground hover:bg-background",
  ghost:
    "border-transparent bg-transparent text-muted-foreground hover:text-foreground hover:bg-card",
  link:
    "border-transparent bg-transparent text-muted-foreground hover:text-accent underline-offset-4 hover:underline px-0",
  "terminal-link":
    "border-transparent bg-transparent text-accent/80 hover:text-accent px-0",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[12px]",
  md: "h-11 px-4 text-[13px]",
  lg: "h-12 px-5 text-[14px]",
  icon: "h-11 w-11 px-0 text-[13px]",
};

const baseClasses =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[2px] border font-mono font-medium leading-none transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-35";

type ButtonOwnProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

export type ButtonProps = ButtonOwnProps & ComponentPropsWithoutRef<"button">;

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export type ButtonLinkProps = ButtonOwnProps & ComponentPropsWithoutRef<typeof Link>;

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </Link>
  );
}

export function ExternalButtonLink({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonOwnProps & ComponentPropsWithoutRef<"a">) {
  return (
    <a
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </a>
  );
}
