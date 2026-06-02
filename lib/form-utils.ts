import { type ClassValue } from "clsx";

export type FieldErrors = Record<string, string[]>;

export interface FormErrors {
  formErrors: string[];
  fieldErrors: FieldErrors;
}

export function getFieldError(
  fieldErrors: FieldErrors | undefined,
  fieldName: string
): string | undefined {
  const errors = fieldErrors?.[fieldName];
  return errors?.[0];
}

export function hasFieldError(
  fieldErrors: FieldErrors | undefined,
  fieldName: string
): boolean {
  return Boolean(fieldErrors?.[fieldName]?.length);
}

export function generateErrorId(fieldName: string): string {
  return `${fieldName}-error`;
}

export function getErrorAriaProps(fieldName: string, hasError: boolean) {
  return {
    "aria-invalid": hasError,
    "aria-describedby": hasError ? generateErrorId(fieldName) : undefined,
  };
}

export function getFieldErrorClasses(
  baseClasses: ClassValue[],
  hasError: boolean
): ClassValue[] {
  return [
    ...baseClasses,
    hasError
      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20 bg-red-50/30"
      : "border-slate-200 focus:border-[#162f67] focus:ring-[#162f67]/20 bg-slate-50",
  ];
}

export function getSelectErrorClasses(hasError: boolean): string {
  return hasError
    ? "border-red-500 focus:border-red-500 bg-red-50/30"
    : "border-slate-200 focus:border-[#162f67] bg-slate-50";
}

export function getCheckboxGroupErrorClasses(hasError: boolean): string {
  return hasError
    ? "border-red-500 bg-red-50/30"
    : "border-slate-200 hover:border-green-300";
}

export function getInputBaseClasses(): ClassValue {
  return [
    "h-11",
    "rounded-xl",
    "transition-all",
    "placeholder:text-slate-500",
    "focus:outline-none",
    "focus:ring-2",
    "focus:ring-offset-0",
    "disabled:cursor-not-allowed",
    "disabled:opacity-50",
  ];
}