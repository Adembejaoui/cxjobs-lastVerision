"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SheetContextValue {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const SheetContext = React.createContext<SheetContextValue | undefined>(undefined)

function useSheet() {
  const context = React.useContext(SheetContext)
  if (!context) {
    throw new Error("Sheet components must be used within a Sheet")
  }
  return context
}

interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Sheet({ open: controlledOpen, onOpenChange, children }: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  
  const setOpen = React.useCallback(
    (value: React.SetStateAction<boolean>) => {
      const newValue = typeof value === "function" ? value(open) : value
      if (!isControlled) {
        setUncontrolledOpen(newValue)
      }
      onOpenChange?.(newValue)
    },
    [isControlled, open, onOpenChange]
  )

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  )
}

interface SheetTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  asChild?: boolean
}

const SheetTrigger = React.forwardRef<HTMLButtonElement, SheetTriggerProps>(
  ({ children, asChild, className, ...props }, ref) => {
    const { setOpen } = useSheet()
    
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
        onClick: () => setOpen(true),
      })
    }
    
    return (
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        {...props}
      >
        {children}
      </button>
    )
  }
)
SheetTrigger.displayName = "SheetTrigger"

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "bottom" | "left" | "right"
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = "left", className, children, ...props }, ref) => {
    const { open, setOpen } = useSheet()

    React.useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape" && open) {
          setOpen(false)
        }
      }
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }, [open, setOpen])

    if (!open) return null



    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
        
        {/* Content */}
        <div
          ref={ref}
          className={cn(
            "fixed z-50 flex flex-col bg-[#071738] text-white shadow-lg transition-transform duration-300",
            side === "left" && "inset-y-0 left-0 translate-x-0",
            side === "right" && "inset-y-0 right-0 translate-x-0",
            side === "top" && "inset-x-0 top-0 translate-y-0",
            side === "bottom" && "inset-x-0 bottom-0 translate-y-0",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </>
    )
  }
)
SheetContent.displayName = "SheetContent"

type SheetHeaderProps = React.HTMLAttributes<HTMLDivElement>

const SheetHeader = React.forwardRef<HTMLDivElement, SheetHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-2 p-6", className)}
      {...props}
    />
  )
)
SheetHeader.displayName = "SheetHeader"

type SheetTitleProps = React.HTMLAttributes<HTMLHeadingElement>

const SheetTitle = React.forwardRef<HTMLHeadingElement, SheetTitleProps>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("text-lg font-semibold text-white", className)}
      {...props}
    />
  )
)
SheetTitle.displayName = "SheetTitle"

export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
}
