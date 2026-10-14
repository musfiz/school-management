import Swal, { type SweetAlertIcon } from "sweetalert2";

/** Shared SweetAlert2 instance styled to match the dashboard's brand colors. */
const swal = Swal.mixin({
  buttonsStyling: false,
  customClass: {
    confirmButton:
      "rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700",
    cancelButton:
      "rounded-md border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50",
    actions: "gap-2",
  },
});

const toastMixin = swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  customClass: {
    popup: "!p-2.5 !px-3.5 !rounded-md !shadow-md !max-w-sm",
    title: "!text-xs !font-semibold !m-0 !p-0 !text-ink-900",
    htmlContainer: "!text-xs !text-ink-600 !m-0 !mt-0.5 !p-0 leading-tight",
    icon: "!m-0 !mr-2 ![font-size:10px]",
  },
});

const TOAST_TITLES: Record<SweetAlertIcon, string> = {
  success: "Success",
  error: "Error",
  warning: "Warning",
  info: "Info",
  question: "Question",
};

/**
 * Compact toast notification in the top corner.
 * The alert status (Success / Error / Info / Warning) is always the title;
 * the operational message is the body text. Can be called with:
 * - toast(message, icon?)
 * - toast({ title, text, icon })
 */
export function toast(
  messageOrOptions: string | { title?: string; text?: string; icon?: SweetAlertIcon },
  icon: SweetAlertIcon = "success",
) {
  if (typeof messageOrOptions === "string") {
    return toastMixin.fire({
      icon,
      title: TOAST_TITLES[icon],
      text: messageOrOptions,
    });
  }

  const { title, text, icon: iconOpt = "success" } = messageOrOptions;
  return toastMixin.fire({
    icon: iconOpt,
    title: title || TOAST_TITLES[iconOpt],
    text,
  });
}

/**
 * Pop-up alert modal with title and message.
 */
export function alertModal(options: {
  title?: string;
  text?: string;
  icon?: SweetAlertIcon;
}) {
  return swal.fire({
    title: options.title ?? (options.icon === "error" ? "Error" : "Success"),
    text: options.text,
    icon: options.icon ?? "success",
    confirmButtonText: "OK",
  });
}

/** Blocking confirmation dialog — resolves true only if the user confirms. */
export async function confirmDialog(options: {
  title: string;
  text?: string;
  confirmText?: string;
  icon?: "warning" | "question" | "info";
  danger?: boolean;
}): Promise<boolean> {
  const result = await swal.fire({
    title: options.title,
    text: options.text,
    icon: options.icon ?? "warning",
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Yes, continue",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    focusCancel: true,
    customClass: {
      confirmButton: options.danger
        ? "rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        : "rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700",
      cancelButton:
        "rounded-md border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50",
      actions: "gap-2",
    },
  });
  return result.isConfirmed;
}

/**
 * Styled input dialog (replaces native `window.prompt`).
 * Resolves the trimmed input string, or `null` when the user cancels.
 * Supports required / minLength / numeric-min / custom validation with
 * inline error messages instead of silent failure.
 */
export async function promptDialog(options: {
  title: string;
  text?: string;
  input?: "text" | "textarea" | "number" | "url";
  inputValue?: string;
  placeholder?: string;
  confirmText?: string;
  icon?: SweetAlertIcon;
  required?: boolean;
  minLength?: number;
  min?: number;
  danger?: boolean;
  validator?: (value: string) => string | null;
}): Promise<string | null> {
  const result = await swal.fire({
    title: options.title,
    text: options.text,
    icon: options.icon ?? "question",
    input: options.input ?? "text",
    inputValue: options.inputValue ?? "",
    inputPlaceholder: options.placeholder,
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Confirm",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    inputValidator: (value: string) => {
      const v = String(value ?? "").trim();
      if (options.required !== false && v.length === 0) {
        return "This field is required.";
      }
      if (options.minLength && v.length < options.minLength) {
        return `Enter at least ${options.minLength} characters.`;
      }
      if (options.input === "number") {
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) {
          return "Enter a valid amount greater than 0.";
        }
        if (options.min !== undefined && n < options.min) {
          return `Amount must be at least ${options.min}.`;
        }
      }
      if (options.validator) {
        return options.validator(v);
      }
      return undefined;
    },
    customClass: {
      confirmButton: options.danger
        ? "rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        : "rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700",
      cancelButton:
        "rounded-md border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50",
      actions: "gap-2",
      input: "rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none",
    },
  });
  if (!result.isConfirmed || result.value === undefined) return null;
  return String(result.value).trim();
}

export default swal;
