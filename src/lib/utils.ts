import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn/ui's standard helper: lets components accept a `className` prop
// and merge it with their own Tailwind classes without conflicts.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
