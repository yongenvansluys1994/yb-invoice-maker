"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { Invoice } from "@/types/invoice";
import SoftCard from "./SoftCard";
import { formatCurrency, formatDate } from "@/lib/settings";

export default function InvoiceTable() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/invoices");
      const serverList: Invoice[] = await res.json();
      setInvoices(serverList);
    })();
  }, []);

  useEffect(() => { setMounted(true); }, []);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      const matchesQuery = !query || i.clientName.toLowerCase().includes(query.toLowerCase());
      const matchesFrom = !from || i.date >= from;
      const matchesTo = !to || i.date <= to;
      return matchesQuery && matchesFrom && matchesTo;
    });
  }, [invoices, query, from, to]);

  async function remove(id: string) {
    setRemovingId(id);
    try {
      await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      setInvoices((prev) => prev.filter((i) => i.id !== id));
      try {
        const localList: Invoice[] = JSON.parse(localStorage.getItem("invgenz:invoices") || "[]");
        localStorage.setItem("invgenz:invoices", JSON.stringify(localList.filter((i) => i.id !== id)));
      } catch {}
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <SoftCard className="p-6">
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          placeholder="Cari klien..."
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <input type="date" className="rounded-xl border border-black/10 bg-white/80 px-3 py-2" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="rounded-xl border border-black/10 bg-white/80 px-3 py-2" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2">Klien</th>
              <th className="py-2">Tanggal</th>
              <th className="py-2">Total</th>
              <th className="py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const total = typeof i.total === "number" ? i.total : (i.items?.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0) || 0);
              return (
                <tr key={i.id} className="border-t border-black/10">
                  <td className="py-2">{i.clientName}</td>
                  <td className="py-2">{mounted ? formatDate(i.date) : i.date}</td>
                  <td className="py-2">{mounted ? formatCurrency(total) : total}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <Link href={`/invoices/${i.id}`} className="text-violet-700 hover:underline">Lihat</Link>
                      <button onClick={() => remove(i.id)} className="text-red-600 hover:underline disabled:opacity-50 flex items-center gap-1" disabled={removingId === i.id}>
                        {removingId === i.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SoftCard>
  );
}