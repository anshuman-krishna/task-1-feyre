"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  indeterminate?: boolean;
};

export const Checkbox = React.forwardRef<HTMLInputElement, Props>(
  ({ className, checked, onCheckedChange, indeterminate, ...props }, forwarded) => {
    const ref = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(forwarded, () => ref.current as HTMLInputElement);
    React.useEffect(() => {
      if (ref.current) ref.current.indeterminate = !!indeterminate;
    }, [indeterminate]);
    return (
      <span
        className={cn(
          "relative inline-flex h-4 w-4 items-center justify-center rounded border border-input bg-surface transition-colors",
          (checked || indeterminate) && "border-primary bg-primary text-primary-foreground",
          className,
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          {...props}
        />
        {(checked || indeterminate) && (
          <Check className="pointer-events-none h-3 w-3" strokeWidth={3} />
        )}
      </span>
    );
  },
);
Checkbox.displayName = "Checkbox";
