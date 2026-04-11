"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const SelectContext = React.createContext<SelectContextValue | undefined>(
  undefined
);

function useSelectContext() {
  const context = React.useContext(SelectContext);
  if (!context) {
    throw new Error("Select components must be used within a Select");
  }
  return context;
}

export function Select({
  value,
  onValueChange,
  children,
  disabled,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <SelectContext.Provider
      value={{ value, onValueChange, open, setOpen }}
    >
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

export interface SelectTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, disabled, ...props }, ref) => {
    const { open, setOpen, value } = useSelectContext();

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#47d79d] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown
          className={cn(
            "h-4 w-4 opacity-50 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
    );
  }
);
SelectTrigger.displayName = "SelectTrigger";

export function SelectValue({
  placeholder,
}: {
  placeholder?: string;
}) {
  const { value } = useSelectContext();
  return (
    <span className={cn(!value && "text-slate-500")}>
      {value || placeholder}
    </span>
  );
}

export function SelectContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { open, setOpen, value, onValueChange } = useSelectContext();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        onClick={() => setOpen(false)}
      />
      {/* Content */}
      <div
        ref={ref}
        className={cn(
          "absolute left-0 top-full z-50 mt-1 max-h-96 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg",
          className
        )}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement<SelectItemProps>(child)) {
            const childValue = child.props.value;
            return React.cloneElement(child, {
              onSelect: () => {
                if (childValue) {
                  onValueChange?.(childValue);
                }
                setOpen(false);
              },
              isSelected: childValue === value,
            } as Partial<SelectItemProps> & { onSelect?: () => void; isSelected?: boolean });
          }
          return child;
        })}
      </div>
    </>
  );
}

export interface SelectItemProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

export function SelectItem({
  value,
  disabled,
  children,
  className,
  onSelect,
  isSelected,
  ...props
}: SelectItemProps & { onSelect?: () => void; isSelected?: boolean }) {
  return (
    <div
      role="option"
      aria-selected={isSelected}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 focus:bg-slate-100",
        disabled && "cursor-not-allowed opacity-50",
        isSelected && "bg-slate-100 text-[#47d79d]",
        className
      )}
      onClick={() => !disabled && onSelect?.()}
      {...props}
    >
      {isSelected && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </span>
      )}
      {children}
    </div>
  );
}
