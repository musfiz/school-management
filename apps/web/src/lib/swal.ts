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
    icon: "!m-0 !mr-2 !w-5 !h-5 !scale-90",
  },
});

/**
 * Compact toast notification in the top corner.
 * Can be called with:
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
      title: messageOrOptions,
    });
  }

  const { title, text, icon: iconOpt = "success" } = messageOrOptions;
  return toastMixin.fire({
    icon: iconOpt,
    title: title || (iconOpt === "success" ? "Success" : "Error"),
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

export default swal;
