"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className={cn(
            "peer h-4 w-4 shrink-0 appearance-none rounded-sm border border-primary ring-offset-background",
            "checked:bg-primary checked:border-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "cursor-pointer",
            className
          )}
          {...props}
        />
        <Check 
          className={cn(
            "absolute h-3 w-3 text-primary-foreground pointer-events-none",
            "top-0.5 left-0.5",
            "opacity-0 peer-checked:opacity-100 transition-opacity"
          )} 
        />
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
