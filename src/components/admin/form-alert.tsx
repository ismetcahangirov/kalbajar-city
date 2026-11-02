import { CircleAlert, CircleCheck } from "lucide-react";

import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/cx";

/**
 * A form-level message, announced when it appears. Colour never carries it
 * alone. The live region is always rendered, so screen readers pick up the
 * message; `className` styles the message, so an empty region takes no space.
 */
export function FormAlert({
  message,
  tone = "error",
  className,
}: {
  message: string | null;
  tone?: "error" | "success";
  className?: string;
}) {
  return (
    <div role={tone === "error" ? "alert" : "status"} aria-live="polite">
      {message ? (
        <p
          className={cx(
            "flex items-start gap-2 rounded-sm border px-4 py-3 text-small",
            tone === "error" ? "border-error text-error" : "border-border-strong text-text",
            className,
          )}
        >
          <Icon icon={tone === "error" ? CircleAlert : CircleCheck} />
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}
