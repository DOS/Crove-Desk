"use client";

import type { ComponentProps } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type SelectionCheckboxProps = ComponentProps<typeof Checkbox> & {
  wrapperClassName?: string;
};

export function SelectionCheckbox({
  className,
  wrapperClassName,
  ...props
}: SelectionCheckboxProps) {
  return (
    <span
      className={cn("inline-flex shrink-0", wrapperClassName)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <Checkbox className={className} {...props} />
    </span>
  );
}
