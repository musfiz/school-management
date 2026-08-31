import Swal from "sweetalert2";

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
});

/** Brief, non-blocking toast in the corner — for success/error/info feedback. */
export function toast(message: string, icon: "success" | "error" | "info" | "warning" = "success") {
  return toastMixin.fire({ icon, title: message });
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
