// Tiny classnames joiner — no clsx dependency in this project.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
