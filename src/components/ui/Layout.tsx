import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ContainerProps = {
  children: ReactNode;
  className?: string;
  size?: "page" | "narrow" | "wide";
};

const containerSizes = {
  page: "max-w-[1120px]",
  narrow: "max-w-[760px]",
  wide: "max-w-[1160px]",
};

export function Container({ children, className, size = "page" }: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-5 sm:px-6 lg:px-8", containerSizes[size], className)}>
      {children}
    </div>
  );
}

type SectionProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
  hero?: boolean;
};

export function Section({ id, children, className, compact = false, hero = false }: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative",
        hero
          ? "py-16 md:py-24"
          : compact
            ? "py-11 md:py-16"
            : "py-14 md:py-[72px]",
        className
      )}
    >
      {children}
    </section>
  );
}

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-8 md:mb-10",
        align === "center" && "mx-auto max-w-[760px] text-center",
        className
      )}
    >
      {eyebrow && (
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-accent/75">
          -- {eyebrow} --
        </p>
      )}
      <h2 className="font-mono text-[24px] leading-[1.16] text-foreground md:text-[34px]">
        {title}
      </h2>
      {description && (
        <p className="mt-3 max-w-[720px] text-[14px] leading-[1.65] text-muted-foreground md:text-[15px]">
          {description}
        </p>
      )}
    </div>
  );
}
