export const controlClass =
  "h-9 rounded-md border border-line bg-white px-2.5 text-sm text-ink outline-none focus-visible:border-accent";

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
