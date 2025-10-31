"use client";
import { useEffect, useMemo, useState } from "react";
import SoftCard from "@/components/SoftCard";
import ChartMini from "@/components/ChartMini";
import ChartBarMini from "@/components/ChartBarMini";
import ChartPieMini from "@/components/ChartPieMini";
import type { Invoice } from "@/types/invoice";
import { Download, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/settings";

type Payment = { id: string; invoiceId: string; amount: number; date: string; method: string };
const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
function labelFor(d: Date) { return months[d.getMonth()]; }
function ym(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function lastMonths(n: number) {
  const res: { label: string; key: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    res.push({ label: labelFor(d), key: ym(d) });
  }
  return res;
}

export default function LaporanPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    (async () => {
      const resInv = await fetch("/api/invoices");
      const serverInv: Invoice[] = await resInv.json();
      setInvoices(serverInv);

      const resPay = await fetch("/api/payments");
      const serverPay: Payment[] = await resPay.json();
      setPayments(serverPay);
    })();
  }, []);

  useEffect(() => { setMounted(true); }, []);

  function invTotal(inv: Invoice) {
    return typeof inv.total === "number" && inv.total > 0 ? inv.total : (inv.items?.reduce((s, it) => s + it.unitPrice * it.quantity, 0) || 0);
  }

  const months3 = lastMonths(3);
  const pendapatanBulanan = useMemo(() => {
    const sum: Record<string, number> = {};
    payments.forEach((p) => {
      const key = ym(new Date(p.date));
      sum[key] = (sum[key] || 0) + p.amount;
    });
    return months3.map((m) => sum[m.key] || 0);
  }, [payments]);

  const invoicePerBulan = useMemo(() => {
    const cnt: Record<string, number> = {};
    invoices.forEach((i) => {
      const key = ym(new Date(i.date));
      cnt[key] = (cnt[key] || 0) + 1;
    });
    return months3.map((m) => cnt[m.key] || 0);
  }, [invoices]);

  const statusData = useMemo(() => {
    const lunas = invoices.filter((i: any) => i.status === "lunas").length;
    const terkirim = invoices.filter((i: any) => i.status === "terkirim").length;
    const draft = invoices.filter((i: any) => i.status === "draft").length;
    return { labels: ["Lunas", "Terkirim", "Draft"], data: [lunas, terkirim, draft] };
  }, [invoices]);

  const topCustomers = useMemo(() => {
    const sumBy: Record<string, number> = {};
    payments.forEach((p) => {
      const inv = invoices.find((i) => i.id === p.invoiceId);
      if (!inv) return;
      sumBy[inv.clientName] = (sumBy[inv.clientName] || 0) + p.amount;
    });
    return Object.entries(sumBy).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [payments, invoices]);

  const unpaid = useMemo(() => invoices.filter((i: any) => i.status !== "lunas"), [invoices]);
  function exportPDF() { window.print(); }
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(unpaid.length / pageSize));
  const visibleUnpaid = useMemo(() => {
    const start = (page - 1) * pageSize;
    return unpaid.slice(start, start + pageSize);
  }, [unpaid, page, pageSize]);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Laporan</h2>
          <p className="text-sm text-black/60">Analisis dan statistik bisnis Anda</p>
        </div>
        <button onClick={exportPDF} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 bg-white hover:bg-black/5 text-sm">
          <Download className="h-4 w-4" /> Export PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SoftCard className="p-6">
          <div className="text-base font-medium mb-3">Pendapatan Bulanan</div>
          <ChartMini dataPoints={pendapatanBulanan} labels={months3.map((m) => m.label)} />
        </SoftCard>
        <SoftCard className="p-6">
          <div className="text-base font-medium mb-3">Jumlah Invoice per Bulan</div>
          <ChartBarMini labels={months3.map((m) => m.label)} data={invoicePerBulan} />
        </SoftCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SoftCard className="p-6">
          <div className="text-base font-medium mb-3">Status Invoice</div>
          <ChartPieMini labels={statusData.labels} data={statusData.data} />
        </SoftCard>

        <SoftCard className="p-6">
          <div className="text-base font-medium mb-3">Pelanggan Terbaik</div>
          <div className="grid gap-2">
            {topCustomers.map(([name, total], idx) => (
              <div key={name} className="flex items-center justify-between rounded-xl border border-black/10 px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-semibold">{idx + 1}</div>
                  <div>
                    <div className="text-sm font-medium">{name}</div>
                    <div className="text-xs text-black/60">{invoices.filter((i) => i.clientName === name).length} invoice</div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-black/70">{mounted ? formatCurrency(Number(total)) : Math.round(Number(total) || 0)}</div>
              </div>
            ))}
            {topCustomers.length === 0 && <div className="text-sm text-black/60">Belum ada data pembayaran.</div>}
          </div>
        </SoftCard>
      </div>

      <SoftCard className="p-6">
        <div className="text-base font-medium mb-3">Invoice Belum Lunas</div>
        {unpaid.length === 0 ? (
          <div className="text-sm text-black/60">Tidak ada invoice belum lunas.</div>
        ) : (
          <div className="grid gap-3">
            {visibleUnpaid.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between rounded-xl border border-black/10 p-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{i.id}</div>
                    <div className="text-xs text-black/60">{i.clientName}</div>
                    {i.dueDate && (<div className="text-xs text-black/60">Jatuh Tempo: {mounted ? formatDate(i.dueDate) : i.dueDate}</div>)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-rose-600">{mounted ? formatCurrency(invTotal(i)) : Math.round(invTotal(i) || 0)}</div>
                  <span className="mt-1 inline-block text-xs px-2 py-1 rounded-full bg-rose-100 text-rose-700">Belum Lunas</span>
                </div>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">Tampilkan</span>
                <select
                  className="text-sm rounded-lg border border-black/10 px-2 py-1 bg-white/70 dark:bg-white/5"
                  value={pageSize}
                  onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-sm">per halaman</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-lg border border-black/10 text-sm disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Sebelumnya
                </button>
                <span className="text-sm">Halaman {page} dari {totalPages}</span>
                <button
                  className="px-3 py-1.5 rounded-lg border border-black/10 text-sm disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </div>
        )}
      </SoftCard>
    </div>
  );
}