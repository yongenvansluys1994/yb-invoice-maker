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
              try {
                const toEmail = ctx?.email;
                const sendRes = await fetch(`/api/invoices/${created.id}/send-email`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ toEmail }),
                });
                const j = await sendRes.json().catch(() => ({}));
                const msg = sendRes.ok ? (j?.message || "Email invoice berhasil dikirim") : (j?.error || "Gagal mengirim email invoice");
                if (sendRes.ok) {
                  toast.success(msg, "Berhasil", 4500);
                } else {
                  toast.error(msg, "Gagal", 4500);
                }
              } catch (e) {
                toast.error("Terjadi kesalahan saat mengirim email invoice", "Gagal", 4500);
              }
            }
            // Setelah menampilkan toast, langsung pindah halaman
            router.push("/invoices");
            return;
          }
        } else {
          router.push("/invoices");
          return;
        }
      } catch (e) {
        router.push("/invoices");
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
            try {
              const toEmail = ctx?.email;
              const sendRes = await fetch(`/api/invoices/${payload.id}/send-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ toEmail }),
              });
              const j = await sendRes.json().catch(() => ({}));
              const msg = sendRes.ok ? (j?.message || "Email invoice berhasil dikirim") : (j?.error || "Gagal mengirim email invoice");
              if (sendRes.ok) {
                toast.success(msg, "Berhasil", 4500);
              } else {
                toast.error(msg, "Gagal", 4500);
              }
            } catch (e) {
              toast.error("Terjadi kesalahan saat mengirim email invoice", "Gagal", 4500);
            }
          }
          // Setelah menampilkan toast, langsung pindah halaman
          router.push("/invoices");
          return;
        }
      } else {
        router.push("/invoices");
        return;
      }
    } catch (e) {
      router.push("/invoices");
    }
  };

  return (
    <div className="grid gap-6">
      <h2 className="text-2xl font-semibold">Edit Invoice</h2>
      <InvoiceForm initial={invoice} onSubmit={handleUpdate} />
    </div>
  );
}