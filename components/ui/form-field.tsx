"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { FieldErrors, generateErrorId, getErrorAriaProps, getFieldError, hasFieldError } from "@/lib/form-utils";

interface FormFieldWrapperProps {
  fieldName: string;
  label?: string;
  required?: boolean;
  fieldErrors?: FieldErrors;
  children: React.ReactNode;
  className?: string;
  descriptionId?: string;
}

export const FormFieldWrapper = React.forwardRef<HTMLDivElement, FormFieldWrapperProps>(
  ({ fieldName, label, required, fieldErrors, children, className}, ref) => {
    const error = getFieldError(fieldErrors, fieldName);
    const hasError = hasFieldError(fieldErrors, fieldName);

    return (
      <div ref={ref} className={cn("space-y-1.5", className)}>
        {label && (
          <Label
            htmlFor={fieldName}
            className={cn(
              "text-xs font-medium text-slate-600 mb-1.5 block",
              hasError && "text-red-600"
            )}
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
        )}
        {React.Children.map(children, (child) => {
          if (React.isValidElement<Record<string, unknown>>(child)) {
            return React.cloneElement(child, {
              id: child.props.id || fieldName,
              ...getErrorAriaProps(fieldName, hasError),
            });
          }
          return child;
        })}
        {hasError && (
          <p
            id={generateErrorId(fieldName)}
            className="text-xs text-red-500 mt-1"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
FormFieldWrapper.displayName = "FormFieldWrapper";

interface FieldLabelProps extends React.ComponentPropsWithoutRef<"label"> {
  fieldName: string;
  required?: boolean;
  fieldErrors?: FieldErrors;
}

export const FieldLabel = React.forwardRef<HTMLLabelElement, FieldLabelProps>(
  ({ fieldName, required, fieldErrors, className, children, ...props }, ref) => {
    const hasError = hasFieldError(fieldErrors, fieldName);

    return (
      <Label
        ref={ref}
        htmlFor={fieldName}
        className={cn(
          "text-xs font-medium text-slate-600 mb-1.5 block",
          hasError && "text-red-600",
          className
        )}
        {...props}
      >
        {children}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
    );
  }
);
FieldLabel.displayName = "FieldLabel";

interface FieldErrorProps {
  fieldName: string;
  fieldErrors?: FieldErrors;
  className?: string;
}

export const FieldError = React.forwardRef<HTMLParagraphElement, FieldErrorProps>(
  ({ fieldName, fieldErrors, className }, ref) => {
    const error = getFieldError(fieldErrors, fieldName);
    const hasError = hasFieldError(fieldErrors, fieldName);

    if (!hasError) return null;

    return (
      <p
        ref={ref}
        id={generateErrorId(fieldName)}
        className={cn("text-xs text-red-500 mt-1", className)}
        role="alert"
      >
        {error}
      </p>
    );
  }
);
FieldError.displayName = "FieldError";

interface FieldInputProps extends React.ComponentPropsWithoutRef<"input"> {
  fieldName: string;
  fieldErrors?: FieldErrors;
  hasIcon?: boolean;
}

export const FieldInput = React.forwardRef<HTMLInputElement, FieldInputProps>(
  ({ fieldName, fieldErrors, className, hasIcon, ...props }, ref) => {
    const hasError = hasFieldError(fieldErrors, fieldName);

    return (
      <input
        ref={ref}
        id={fieldName}
        {...getErrorAriaProps(fieldName, hasError)}
        className={cn(
          "flex h-11 w-full rounded-xl border px-3 py-2 text-sm",
          "placeholder:text-slate-500",
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          hasIcon && "pl-10",
          hasError
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20 bg-red-50/30"
            : "border-slate-200 focus:border-[#162f67] focus:ring-[#162f67]/20 bg-slate-50",
          className
        )}
        {...props}
      />
    );
  }
);
FieldInput.displayName = "FieldInput";

interface FieldTextareaProps extends React.ComponentPropsWithoutRef<"textarea"> {
  fieldName: string;
  fieldErrors?: FieldErrors;
}

export const FieldTextarea = React.forwardRef<HTMLTextAreaElement, FieldTextareaProps>(
  ({ fieldName, fieldErrors, className, ...props }, ref) => {
    const hasError = hasFieldError(fieldErrors, fieldName);

    return (
      <textarea
        ref={ref}
        id={fieldName}
        {...getErrorAriaProps(fieldName, hasError)}
        className={cn(
          "flex min-h-[60px] w-full rounded-xl border px-3 py-2 text-sm",
          "placeholder:text-slate-500",
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "resize-none",
          hasError
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20 bg-red-50/30"
            : "border-slate-200 focus:border-[#162f67] focus:ring-[#162f67]/20 bg-slate-50",
          className
        )}
        {...props}
      />
    );
  }
);
FieldTextarea.displayName = "FieldTextarea";

interface FieldSelectProps extends React.ComponentPropsWithoutRef<"select"> {
  fieldName: string;
  fieldErrors?: FieldErrors;
}

export const FieldSelect = React.forwardRef<HTMLSelectElement, FieldSelectProps>(
  ({ fieldName, fieldErrors, className, ...props }, ref) => {
    const hasError = hasFieldError(fieldErrors, fieldName);

    return (
      <select
        ref={ref}
        id={fieldName}
        {...getErrorAriaProps(fieldName, hasError)}
        className={cn(
          "flex h-11 w-full rounded-xl border px-3 py-2 text-sm",
          "appearance-none cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          hasError
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20 bg-red-50/30"
            : "border-slate-200 focus:border-[#162f67] focus:ring-[#162f67]/20 bg-slate-50",
          className
        )}
        {...props}
      />
    );
  }
);
FieldSelect.displayName = "FieldSelect";

interface FieldCheckboxProps extends React.ComponentPropsWithoutRef<"input"> {
  fieldName: string;
  fieldErrors?: FieldErrors;
}

export const FieldCheckbox = React.forwardRef<HTMLInputElement, FieldCheckboxProps>(
  ({ fieldName, fieldErrors, className, ...props }, ref) => {
    const hasError = hasFieldError(fieldErrors, fieldName);

    return (
      <input
        ref={ref}
        type="checkbox"
        id={fieldName}
        {...getErrorAriaProps(fieldName, hasError)}
        className={cn(
          "h-4 w-4 rounded border",
          "focus:ring-2 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "cursor-pointer",
          hasError
            ? "border-red-500 text-red-600 focus:ring-red-500/20"
            : "border-slate-300 text-[#162f67] focus:ring-[#162f67]/20",
          className
        )}
        {...props}
      />
    );
  }
);
FieldCheckbox.displayName = "FieldCheckbox";

export {
  getFieldError,
  hasFieldError,
  generateErrorId,
  getErrorAriaProps,
};