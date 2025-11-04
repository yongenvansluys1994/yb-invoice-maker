"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Invoice } from "@/types/invoice";
import SoftCard from "@/components/SoftCard";
import { Eye, Download, Filter, Plus, Search, Loader2, ChevronLeft, ChevronRight, Trash2, MoreHorizontal, Printer, Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/settings";
import { toast } from "@/lib/toast";

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    const now = new Date();
    now.setDate(now.getDate() + days);
    return now.toISOString().slice(0, 10);
  }
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function InvoicesPage() {
  const [list, setList] = useState<ViewInvoice[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"semua" | "draft" | "terkirim" | "lunas">("semua");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/invoices", { credentials: "include" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Gagal memuat invoice" }));
          const msg = typeof err?.error === "string" ? err.error : "Gagal memuat invoice";
          toast.error(msg, "Gagal", 4500);
          setList([]);
          return;
        }
        const raw = await res.json().catch(() => []);
        const serverList: Invoice[] = Array.isArray(raw) ? raw : [];

        const views: ViewInvoice[] = serverList.map((inv) => {
          const existingStatus = (inv as any).status as ViewInvoice["status"] | undefined;
          const givenDue = (inv as any).dueDate as string | undefined;
          const due = givenDue ?? addDays(inv.date || new Date().toISOString().slice(0, 10), 30);
          let status: ViewInvoice["status"] = existingStatus ?? "terkirim";
          if (!existingStatus) {
            // Aturan sederhana untuk demo status
            const ageDays = Math.floor((Date.now() - new Date(inv.date || new Date().toISOString().slice(0, 10)).getTime()) / 86400000);
            if (inv.items.length === 0) status = "draft";
            else if (ageDays > 40) status = "lunas"; // invoice lama dianggap lunas
            else status = "terkirim";
          }
          return { ...inv, dueDate: due, status };
        });

        setList(views);
      } catch {
        toast.error("Kesalahan jaringan saat memuat invoice", "Gagal", 4500);
        setList([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const byQuery = list.filter((i) => {
      const fields = [i.id ?? "", i.clientName ?? ""];
      const q = (query ?? "").toLowerCase();
      return fields.some((s) => String(s).toLowerCase().includes(q));
    });
    if (filter === "semua") return byQuery;
    return byQuery.filter((i) => i.status === filter);
  }, [list, query, filter]);

  // Reset halaman saat filter atau pencarian berubah
  useEffect(() => {
    setPage(1);
  }, [query, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const paginated = filtered.slice(startIndex, endIndex);

  async function removeInvoice(id: string) {
    const ok = window.confirm("Yakin menghapus invoice ini?");
    if (!ok) return;
    setRemovingId(id);
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setList((prev) => prev.filter((i) => i.id !== id));
        toast.success("Invoice berhasil dihapus");
      } else {
        toast.error("Gagal menghapus invoice");
      }
    } catch {
      toast.error("Kesalahan jaringan saat menghapus invoice");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Invoice</h2>
          <p className="text-sm text-black/60">Kelola semua invoice Anda</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Cari..."
              className="pl-8 pr-3 py-2 rounded-lg border border-black/10 bg-white/70 dark:bg-white/5"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
          </div>
          <select className="px-3 py-2 rounded-lg border border-black/10 bg-white/70 dark:bg-white/5" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="semua">Semua</option>
            <option value="terkirim">Terkirim</option>
            <option value="lunas">Lunas</option>
            <option value="draft">Draft</option>
          </select>
          <Link href="/invoices/new" className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg border border-black/10 bg-white/70 dark:bg-white/5">
            <Plus className="h-4 w-4" />
            Buat Invoice
          </Link>
        </div>
      </div>

      {loading ? (
        <SoftCard className="p-6 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Sedang memuat data...</span>
        </SoftCard>
      ) : (
        <SoftCard className="p-6 overflow-x-auto min-h-[480px]">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-black/60">
              <tr>
                <th className="px-3 py-2 text-left">Invoice</th>
                <th className="px-3 py-2 text-left">Klien</th>
                <th className="px-3 py-2 text-left">Tanggal</th>
                <th className="px-3 py-2 text-left">Jatuh Tempo</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {paginated.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-3 py-3 font-medium">{inv.id}</td>
                  <td className="px-3 py-3">{inv.clientName}</td>
                  <td className="px-3 py-3">{mounted ? formatDate(inv.date) : inv.date}</td>
                  <td className="px-3 py-3">{mounted ? formatDate(inv.dueDate) : inv.dueDate}</td>
                  <td className="px-3 py-3">
                    {inv.status === "lunas" ? (
                      <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Lunas</span>
                    ) : inv.status === "draft" ? (
                      <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700">Draft</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">Terkirim</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-violet-700">{mounted ? formatCurrency(inv.total) : Math.round(inv.total || 0)}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="relative inline-block text-left">
                      <button
                        className="inline-flex items-center justify-center rounded-lg border border-black/10 bg-white/70 dark:bg-white/5 px-2 py-1"
                        onClick={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openMenuId === inv.id ? (
                        <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-black/10 bg-white shadow-lg">
                          <div className="py-1 text-sm">
                            {/** Gunakan short id di URL agar tidak menampilkan format/prefix */}
                            {(() => {
                              const m = (inv.id || "").match(/(\d{8})-(\d+)$/);
                              const shortId = m ? `${m[1]}-${m[2]}` : inv.id;
                              return (
                                <>
                                <Link
                              href={`/invoices/${shortId}`}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-black/5"
                              onClick={() => setOpenMenuId(null)}
                            >
                              <Eye className="h-4 w-4" />
                              Lihat
                            </Link>
                          <button
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-black/5"
                            onClick={() => { setOpenMenuId(null); try { window.open(`/invoices/${shortId}/print`, "_blank"); } catch {} }}
                          >
                            <Printer className="h-4 w-4" />
                            Cetak
                          </button>
                          {inv.status === "lunas" ? (
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-black/5"
                              onClick={() => { setOpenMenuId(null); try { window.open(`/invoices/${shortId}/receipt`, "_blank"); } catch {} }}
                            >
                              <Receipt className="h-4 w-4" />
                              Cetak Kwitansi
                            </button>
                          ) : null}
                          <button
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-black/5"
                            onClick={() => { setOpenMenuId(null); try { window.open(`/invoices/${shortId}/print?pdf=1`, "_blank"); } catch {} }}
                          >
                            <Download className="h-4 w-4" />
                            PDF
                            </button>
                                </>
                              );
                            })()}
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-black/5 disabled:opacity-50"
                              onClick={() => { setOpenMenuId(null); removeInvoice(inv.id); }}
                              disabled={removingId === inv.id}
                            >
                              {removingId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              Hapus
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-3 text-center text-black/60">Tidak ada invoice sesuai filter.</td>
                </tr>
              )}
            </tbody>
          </table>
          {/* Pagination controls */}
          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-xs text-black/60">
              Menampilkan {filtered.length === 0 ? 0 : startIndex + 1}–{endIndex} dari {filtered.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg border border-black/10 bg-white/70 dark:bg-white/5 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Sebelumnya
              </button>
              <span className="text-xs text-black/60">Halaman {page} dari {pageCount}</span>
              <button
                className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg border border-black/10 bg-white/70 dark:bg-white/5 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
              >
                Berikutnya
                <ChevronRight className="h-4 w-4" />
              </button>
              <select
                className="ml-2 text-xs px-2 py-1 rounded-lg border border-black/10 bg-white/70 dark:bg-white/5"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              >
                <option value={5}>5/hal</option>
                <option value={10}>10/hal</option>
                <option value={20}>20/hal</option>
              </select>
            </div>
          </div>
        </SoftCard>
      )}
    </div>
  );
}

interface ViewInvoice extends Invoice {
  dueDate: string;
  status: "terkirim" | "lunas" | "draft";
}