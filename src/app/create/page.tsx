"use client";
import { useRouter } from "next/navigation";
import InvoiceForm from "@/components/InvoiceForm";
import type { Invoice } from "@/types/invoice";
import { toast } from "@/lib/toast";

export default function CreateInvoicePage() {
  const router = useRouter();

  const handleCreate = async (payload: Invoice) => {
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = await res.json();
        try {
          const listRaw = localStorage.getItem("invgenz:invoices") || "[]";
          const list: Invoice[] = JSON.parse(listRaw);
          localStorage.setItem("invgenz:invoices", JSON.stringify([saved, ...list]));
        } catch {}
        toast.success("Invoice berhasil dibuat");
      } else {
        toast.error("Gagal membuat invoice");
      }
    } finally {
      router.push("/invoices");
    }
  };

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Buat Invoice Baru</h1>
        <div className="text-sm text-black/60">Lengkapi detail invoice di bawah ini</div>
      </div>
      <InvoiceForm onSubmit={handleCreate} />
    </div>
  );
}