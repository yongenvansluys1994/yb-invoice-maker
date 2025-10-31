export type ToastType = "success" | "error" | "info" | "warning";

export type ToastPayload = {
  title?: string;
  message: string;
  type?: ToastType;
  durationMs?: number; // default 3500
};

export function showToast(payload: ToastPayload) {
  try {
    const event = new CustomEvent("invgenz:toast", { detail: payload });
    window.dispatchEvent(event);
  } catch {}
}

export const toast = {
  success(message: string, title = "Berhasil", durationMs?: number) {
    showToast({ title, message, type: "success", durationMs });
  },
  error(message: string, title = "Gagal", durationMs?: number) {
    showToast({ title, message, type: "error", durationMs });
  },
  info(message: string, title = "Info", durationMs?: number) {
    showToast({ title, message, type: "info", durationMs });
  },
  warning(message: string, title = "Perhatian", durationMs?: number) {
    showToast({ title, message, type: "warning", durationMs });
  },
};