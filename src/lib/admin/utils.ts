import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's default scale. The project's type
 * tokens (`text-small`, `text-title`, …) would otherwise read as colours and
 * be dropped next to `text-text-muted`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display-xl",
        "display",
        "heading",
        "title",
        "stat",
        "body-lg",
        "body",
        "small",
        "eyebrow",
        "wordmark",
      ],
    },
  },
});

/** Joins class names and lets a later Tailwind class win over an earlier one. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
