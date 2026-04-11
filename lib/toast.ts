import { toast as sonnerToast } from "sonner";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Show a toast notification
 * @param type - Type of toast: "success", "error", "info", or "warning"
 * @param message - Main message to display
 * @param options - Optional configuration for the toast
 */
export function showToast(
  type: ToastType,
  message: string,
  options?: ToastOptions
) {
  const toastOptions = {
    description: options?.description,
    duration: options?.duration,
    action: options?.action,
  };

  switch (type) {
    case "success":
      sonnerToast.success(message, toastOptions);
      break;
    case "error":
      sonnerToast.error(message, toastOptions);
      break;
    case "info":
      sonnerToast.info(message, toastOptions);
      break;
    case "warning":
      sonnerToast.warning(message, toastOptions);
      break;
    default:
      sonnerToast(message, toastOptions);
  }
}

/**
 * Show a success toast
 * @param message - Main message to display
 * @param options - Optional configuration for the toast
 */
export function showSuccess(message: string, options?: ToastOptions) {
  showToast("success", message, options);
}

/**
 * Show an error toast
 * @param message - Main message to display
 * @param options - Optional configuration for the toast
 */
export function showError(message: string, options?: ToastOptions) {
  showToast("error", message, options);
}

/**
 * Show an info toast
 * @param message - Main message to display
 * @param options - Optional configuration for the toast
 */
export function showInfo(message: string, options?: ToastOptions) {
  showToast("info", message, options);
}

/**
 * Show a warning toast
 * @param message - Main message to display
 * @param options - Optional configuration for the toast
 */
export function showWarning(message: string, options?: ToastOptions) {
  showToast("warning", message, options);
}

/**
 * Dismiss all toasts
 */
export function dismissAllToasts() {
  sonnerToast.dismiss();
}

// Re-export the original toast for advanced usage
export { sonnerToast as toast };
