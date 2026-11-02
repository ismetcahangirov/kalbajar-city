import * as React from "react";
import { cn } from "@/lib/admin/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input text-base shadow-xs placeholder:text-muted-foreground focus-visible:border-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
