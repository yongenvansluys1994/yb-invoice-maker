"use client";
import { useEffect, useMemo, useState } from "react";
import SoftCard from "@/components/SoftCard";
import StatCard from "@/components/StatCard";
import ChartMini from "@/components/ChartMini";
import ChartBarMini from "@/components/ChartBarMini";
import type { Invoice } from "@/types/invoice";
import { FileText, DollarSign, Clock, Users, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate, getSettings, fetchSettings } from "@/lib/settings";

function monthLabels(count: number) {
  const { language } = getSettings();
  const now = new Date();
  const labels: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleString(language, { month: "short" }));
  }
  return labels;
}

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showProfileReminder, setShowProfileReminder] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/invoices", { cache: "no-store", headers: { accept: "application/json" } });
        if (!res.ok) {
          // Jika tidak terautentik atau gagal, aman-kan ke array kosong
          setInvoices([]);
          return;
        }
        const data = await res.json().catch(() => []);
        setInvoices(Array.isArray(data) ? data : []);
      } catch {
        setInvoices([]);
      }
    })();
  }, []);

  // Tampilkan modal pengingat bila nama pemilik/penandatangan belum diisi (cek ke server agar akurat)
  useEffect(() => {
    (async () => {
      try {
        const s = await fetchSettings();
        const missingOwner = !s.ownerName || String(s.ownerName).trim() === "";
        const missingTitle = !s.ownerTitle || String(s.ownerTitle).trim() === "";
        setShowProfileReminder(missingOwner || missingTitle);
      } catch {
        // Fallback ke cache lokal jika fetch gagal
        try {
          const s = getSettings();
          const missingOwner = !s.ownerName || String(s.ownerName).trim() === "";
          const missingTitle = !s.ownerTitle || String(s.ownerTitle).trim() === "";
          setShowProfileReminder(missingOwner || missingTitle);
        } catch {}
      }
    })();
  }, []);

  const totalRevenue = useMemo(
    () =>
      invoices.reduce(
        (sum, i) =>
          sum + (typeof i.total === "number" ? i.total : (i.items?.reduce((s, it) => s + it.unitPrice * it.quantity, 0) || 0)),
        0
      ),
    [invoices]
  );

  const unpaidCount = useMemo(() => invoices.length, [invoices]); // placeholder: tanpa status, anggap belum lunas
  const activeClientCount = useMemo(() => new Set(invoices.map((i) => i.clientName)).size, [invoices]);

  // Agregasi per bulan (3 bulan terakhir)
  const labels3 = monthLabels(3);
  const monthlyRevenue = useMemo(() => {
    return labels3.map((label, idx) => {
      const ref = new Date(new Date().getFullYear(), new Date().getMonth() - (labels3.length - 1 - idx), 1);
      const m = ref.getMonth();
      const y = ref.getFullYear();
      return invoices
        .filter((inv) => {
          const d = inv.date ? new Date(inv.date) : undefined;
          return d && d.getMonth() === m && d.getFullYear() === y;
        })
        .reduce(
          (s, inv) => s + (typeof inv.total === "number" ? inv.total : (inv.items?.reduce((x, it) => x + it.unitPrice * it.quantity, 0) || 0)),
          0
        );
    });
  }, [invoices, labels3]);

  const monthlyInvoiceCount = useMemo(() => {
    return labels3.map((label, idx) => {
      const ref = new Date(new Date().getFullYear(), new Date().getMonth() - (labels3.length - 1 - idx), 1);
      const m = ref.getMonth();
      const y = ref.getFullYear();
      return invoices.filter((inv) => {
        const d = inv.date ? new Date(inv.date) : undefined;
        return d && d.getMonth() === m && d.getFullYear() === y;
      }).length;
    });
  }, [invoices, labels3]);

  return (
    <div className="grid gap-6">
      {showProfileReminder && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { setShowProfileReminder(false); }} />
          <SoftCard className="relative z-10 w-full max-w-lg p-5">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-yellow-100 text-yellow-700 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold">Pengaturan Belum Lengkap</div>
                <div className="text-sm text-black/70 mt-1">Sebelum memulai, silahkan ke menu Pengaturan untuk mengisi Profil Perusahaan dan pengaturan Invoice Anda.</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="px-3 py-2 rounded-xl border border-black/10"
                onClick={() => {
                  setShowProfileReminder(false);
                }}
              >
                Nanti Saja
              </button>
              <a
                href="/settings"
                className="px-3 py-2 rounded-xl bg-violet-600 text-white"
              >
                Buka Pengaturan
              </a>
            </div>
          </SoftCard>
        </div>
      )}
      <div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="text-sm text-black/60">Selamat datang kembali! Berikut ringkasan bisnis Anda.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Invoice" value={invoices.length} icon={<FileText className="h-6 w-6" />} variant="purple" />
        <StatCard title="Total Pendapatan" value={formatCurrency(totalRevenue)} icon={<DollarSign className="h-6 w-6" />} variant="pink" />
        <StatCard title="Invoice Belum Lunas" value={unpaidCount} icon={<Clock className="h-6 w-6" />} variant="blue" />
        <StatCard title="Pelanggan Aktif" value={activeClientCount} icon={<Users className="h-6 w-6" />} variant="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartMini dataPoints={monthlyRevenue.length ? monthlyRevenue : [0, 0, 0]} labels={labels3} title="Pendapatan Bulanan" />
        <ChartBarMini data={monthlyInvoiceCount.length ? monthlyInvoiceCount : [0, 0, 0]} labels={labels3} title="Invoice per Bulan" />
      </div>

      <SoftCard className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Invoice Terbaru</div>
            <p className="text-xs text-black/60">Lihat ringkas 3 invoice terakhir</p>
          </div>
          <a href="/invoices" className="text-sm px-3 py-1 rounded-lg bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20">Lihat Semua</a>
        </div>
        <div className="mt-4 space-y-3">
          {invoices.slice(-3).map((inv) => (
            <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">🧾</div>
                <div>
                  <div className="text-sm font-medium">{inv.id}</div>
                  <div className="text-xs text-black/60">{inv.clientName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{formatCurrency(typeof inv.total === "number" ? inv.total : (inv.items?.reduce((s, it) => s + it.unitPrice * it.quantity, 0) || 0))}</div>
                <div className="text-[11px] text-black/60">{inv.date ? formatDate(inv.date) : "—"}</div>
              </div>
            </div>
          ))}
          {invoices.length === 0 && (
            <div className="text-sm text-black/60">Belum ada invoice. Buat invoice baru di menu "Invoice".</div>
          )}
        </div>
      </SoftCard>
    </div>
  );
}