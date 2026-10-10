import * as React from "react";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-xs font-medium uppercase tracking-[0.14em] text-subtle", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";
