"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ToastPayload, ToastType } from "@/lib/toast";

type ToastItem = {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  createdAt: number;
  durationMs: number;
};

function styleByType(t: ToastType) {
  switch (t) {
    case "success":
      return "bg-emerald-100 text-emerald-900 border-emerald-300";
    case "error":
      return "bg-red-100 text-red-900 border-red-300";
    case "warning":
      return "bg-amber-100 text-amber-900 border-amber-300";
    default:
      return "bg-blue-100 text-blue-900 border-blue-300";
  }
}

export default function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onToast(e: Event) {
      const ce = e as CustomEvent<ToastPayload>;
      const payload = ce.detail;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: ToastItem = {
        id,
        title: payload.title,
        message: payload.message,
        type: payload.type || "info",
        createdAt: Date.now(),
        durationMs: payload.durationMs ?? 3500,
      };
      setToasts((prev) => [item, ...prev].slice(0, 5));
      // auto remove
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, item.durationMs);
      return () => clearTimeout(timer);
    }
    window.addEventListener("invgenz:toast", onToast as EventListener);
    return () => window.removeEventListener("invgenz:toast", onToast as EventListener);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div 
      className="pointer-events-none fixed bottom-6 right-6 z-[9998] flex flex-col-reverse gap-2"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9998,
        pointerEvents: 'none'
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto shadow-lg rounded-xl border ${styleByType(t.type)} px-4 py-3 w-[320px] animate-slide-up`}
          style={{ pointerEvents: 'auto' }}
        >
          {t.title ? <div className="text-sm font-semibold">{t.title}</div> : null}
          <div className="text-sm">{t.message}</div>
          <button
            className="absolute top-1 right-2 text-xs text-black/50 hover:text-black"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            aria-label="Close toast"
          >×</button>
        </div>
      ))}
    </div>,
    document.body
  );
}