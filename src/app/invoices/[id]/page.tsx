"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import InvoiceForm from "@/components/InvoiceForm";
import type { Invoice } from "@/types/invoice";
import { toast } from "@/lib/toast";

export default function EditInvoicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  // Fetch hanya untuk mode edit; mode "new" tidak perlu fetch
  useEffect(() => {
    if (params.id === "new") return;
    (async () => {
      try {
        const res = await fetch(`/api/invoices/${params.id}`);
        if (res.ok) {
          setInvoice(await res.json());
          return;
        }
      } catch {}
    })();
  }, [params.id]);

  // Mode pembuatan invoice baru
  if (params.id === "new") {
    const handleCreate = async (payload: Invoice, ctx?: { email?: string }) => {
      try {
        const res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created: Invoice | null = await res.json().catch(() => null);
          if (!created) {
            toast.error("Respon server tidak valid saat membuat invoice");
            router.push("/invoices");
            return;
          } else {
            // Kirim email HANYA jika status terkirim
            if ((created.status || "terkirim") === "terkirim") {
              const toEmail = ctx?.email;
              // Enqueue background send agar UI tidak menunggu lama
              const sendRes = await fetch(`/api/invoices/${created.id}/send-email/enqueue`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ toEmail }),
              });
              const j = await sendRes.json().catch(() => ({}));
              if (sendRes.ok) {
                toast.success(j?.message || "Email invoice sedang dikirim di background", "Berhasil", 4500);
              } else {
                toast.error(j?.error || "Gagal menjadwalkan pengiriman email", "Gagal", 4500);
              }
            }
            // Setelah menampilkan toast, langsung pindah halaman
            router.push("/invoices");
            return;
          }
        } else {
          // Tampilkan pesan error dari server jika ada, jangan silent redirect
          const err = await res.json().catch(() => ({ error: "Gagal membuat invoice" }));
          const msg = typeof err?.error === "string" ? err.error : "Gagal membuat invoice";
          toast.error(msg, "Gagal", 4500);
          return;
        }
      } catch (e) {
        toast.error("Terjadi kesalahan jaringan saat membuat invoice", "Gagal", 4500);
      }
    };
    return (
      <div className="grid gap-6">
        <h2 className="text-2xl font-semibold">Buat Invoice</h2>
        <InvoiceForm onSubmit={handleCreate} />
      </div>
    );
  }

  // Tampilkan loading sampai data edit tersedia
  if (!invoice) return <div>Memuat...</div>;

  const handleUpdate = async (payload: Invoice, ctx?: { email?: string }) => {
    try {
      const res = await fetch(`/api/invoices/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated: Invoice | null = await res.json().catch(() => null);
        if (!updated) {
          toast.error("Respon server tidak valid saat memperbarui invoice");
          router.push("/invoices");
          return;
        } else {
          // Kirim email HANYA jika status terkirim
          if ((updated.status || "terkirim") === "terkirim") {
            const toEmail = ctx?.email;
            const sendRes = await fetch(`/api/invoices/${payload.id}/send-email/enqueue`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ toEmail }),
            });
            const j = await sendRes.json().catch(() => ({}));
            if (sendRes.ok) {
              toast.success(j?.message || "Email invoice sedang dikirim di background", "Berhasil", 4500);
            } else {
              toast.error(j?.error || "Gagal menjadwalkan pengiriman email", "Gagal", 4500);
            }
          }
          // Setelah menampilkan toast, langsung pindah halaman
          router.push("/invoices");
          return;
        }
      } else {
        const err = await res.json().catch(() => ({ error: "Gagal memperbarui invoice" }));
        const msg = typeof err?.error === "string" ? err.error : "Gagal memperbarui invoice";
        toast.error(msg, "Gagal", 4500);
        return;
      }
    } catch (e) {
      toast.error("Terjadi kesalahan jaringan saat memperbarui invoice", "Gagal", 4500);
    }
  };

  return (
    <div className="grid gap-6">
      <h2 className="text-2xl font-semibold">Edit Invoice</h2>
      <InvoiceForm initial={invoice} onSubmit={handleUpdate} />
    </div>
  );
}