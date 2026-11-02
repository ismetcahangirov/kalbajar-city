import * as React from "react";
import { cn } from "@/lib/admin/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input text-base shadow-xs selection:bg-primary selection:text-primary-foreground file:text-sm file:text-foreground placeholder:text-muted-foreground md:text-sm h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
