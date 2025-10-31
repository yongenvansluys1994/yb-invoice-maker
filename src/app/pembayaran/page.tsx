"use client";
import { useEffect, useMemo, useState } from "react";
import SoftCard from "@/components/SoftCard";
import StatCard from "@/components/StatCard";
import type { Invoice } from "@/types/invoice";
import { DollarSign, CreditCard, Calendar, Plus, Banknote, X, Loader2 } from "lucide-react";
import { formatCurrency, formatDate, getSettings } from "@/lib/settings";
import { toast } from "@/lib/toast";

type Payment = {
  id: string;
  invoiceId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  method: string;
  note?: string;
  bankAccount?: string;
  bankName?: string;
};

export default function PembayaranPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<{ bankName: string; accountNumber: string; alias?: string }[]>([]);
  const todayISO = new Date().toISOString().slice(0, 10);
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<{ invoiceId: string; amount: number; date: string; method: string; note?: string; bankAccount?: string; bankName?: string }>({
    invoiceId: "",
    amount: 0,
    date: todayISO,
    method: "Transfer Bank",
    note: "",
    bankAccount: "",
    bankName: "",
  });
  const [amountText, setAmountText] = useState<string>("0");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [resInv, resPay] = await Promise.all([fetch("/api/invoices"), fetch("/api/payments")]);
        const serverInv: Invoice[] = await resInv.json();
        setInvoices(serverInv);

        const serverPay: Payment[] = await resPay.json();
        serverPay.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPayments(serverPay);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    // load bank accounts from settings
    try {
      const s = getSettings();
      const accs = s.bankAccounts || [];
      setBankAccounts(accs);
      setForm((f) => ({
        ...f,
        bankAccount: accs[0]?.accountNumber || "",
        bankName: accs[0]?.bankName || "",
      }));
    } catch {}
  }, []);

  function invoiceTotal(inv: Invoice) {
    if (typeof inv.total === "number" && inv.total > 0) return inv.total;
    return inv.items?.reduce((s, it) => s + it.unitPrice * it.quantity, 0) || 0;
  }

  async function refreshInvoicesFromServer() {
    try {
      const resInv = await fetch("/api/invoices");
      const serverInv: Invoice[] = await resInv.json();
      setInvoices(serverInv);
    } catch {}
  }

  const invoiceMap = useMemo(() => {
    const m = new Map<string, Invoice>();
    invoices.forEach((inv) => m.set(inv.id, inv));
    return m;
  }, [invoices]);

  const todaysTotal = useMemo(() => payments.filter((p) => p.date === todayISO).reduce((s, p) => s + p.amount, 0), [payments, todayISO]);
  const unpaidCount = useMemo(() => invoices.filter((inv: any) => inv.status !== "lunas").length, [invoices]);
  const totalTransaksi = payments.length;
  const totalPages = Math.max(1, Math.ceil(totalTransaksi / pageSize));
  const visiblePayments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return payments.slice(start, start + pageSize);
  }, [payments, page, pageSize]);

  function openModal() {
    setErrors({});
    const accs = bankAccounts;
    setForm({
      invoiceId: "",
      amount: 0,
      date: todayISO,
      method: "Transfer Bank",
      note: "",
      bankAccount: accs[0]?.accountNumber || "",
      bankName: accs[0]?.bankName || "",
    });
    setAmountText("0");
    setModalOpen(true);
  }

  async function savePayment() {
    const errs: Record<string, string> = {};
    if (!form.invoiceId) errs.invoiceId = "Pilih invoice";
    if (!form.amount || form.amount <= 0) errs.amount = "Masukkan nominal";
    if (form.method === "Transfer Bank" && !form.bankAccount) errs.bankAccount = "Pilih rekening bank";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: form.invoiceId,
          amount: Number(form.amount),
          date: form.date,
          method: form.method,
          note: form.note,
        }),
      });
      if (!res.ok) {
        toast.error("Gagal mencatat pembayaran");
        return;
      }
      const created: Payment = await res.json();
      const list = [created, ...payments];
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPayments(list);
      await refreshInvoicesFromServer();
      setModalOpen(false);
      toast.success("Pembayaran berhasil dicatat");
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Pembayaran</h2>
          <p className="text-sm text-black/60">Catat dan kelola pembayaran invoice</p>
        </div>
        <button onClick={openModal} className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white text-sm px-3 py-2 rounded-xl shadow-sm">
          <span className="text-lg leading-none">＋</span>
          Catat Pembayaran
        </button>
      </div>

      {/* Kartu statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SoftCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-black/60">Total Pembayaran Hari Ini</div>
              <div className="mt-2 text-2xl font-bold">{mounted ? formatCurrency(todaysTotal) : Math.round(todaysTotal || 0)}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </SoftCard>
        <SoftCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-black/60">Invoice Belum Lunas</div>
              <div className="mt-2 text-2xl font-bold">{unpaidCount}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
              <CreditCard className="h-6 w-6" />
            </div>
          </div>
        </SoftCard>
        <SoftCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-black/60">Total Transaksi</div>
              <div className="mt-2 text-2xl font-bold">{totalTransaksi}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
        </SoftCard>
      </div>

      {/* Riwayat Pembayaran */}
      <div>
        <div className="text-xl font-semibold mb-3">Riwayat Pembayaran</div>
        <div className="grid gap-3">
          {loading ? (
            <SoftCard className="p-6 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Sedang memuat data...</span>
            </SoftCard>
          ) : visiblePayments.map((p) => {
            const inv = invoiceMap.get(p.invoiceId);
            const isPaid = (inv as any)?.status === "lunas";
            const paidSum = payments.filter((x) => x.invoiceId === p.invoiceId).reduce((s, x) => s + x.amount, 0);
            const full = inv ? paidSum >= invoiceTotal(inv) : true;
            return (
              <SoftCard key={p.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Banknote className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{p.invoiceId}</div>
                      <div className="text-xs text-black/60">{mounted ? formatDate(p.date) : p.date} • {p.method}</div>
                      <div className="text-xs text-black/60">{full ? "Pembayaran penuh" : "Pembayaran parsial"}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-600">{mounted ? formatCurrency(p.amount) : Math.round(p.amount || 0)}</div>
                    <div className="mt-2">
                      {isPaid ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Lunas</span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Belum Lunas</span>
                      )}
                    </div>
                  </div>
                </div>
              </SoftCard>
            );
          })}
          {!loading && payments.length === 0 && (
            <SoftCard className="p-6">
              <div className="text-sm text-black/60">Belum ada data pembayaran.</div>
            </SoftCard>
          )}
        </div>
        {!loading && payments.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
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
        )}
      </div>

      {/* Modal catat pembayaran */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <SoftCard className="relative z-10 w-full max-w-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xl font-semibold">Catat Pembayaran</div>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg hover:bg-black/5"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3">
              <div>
                <label className="text-sm">Invoice *</label>
                <select className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400" value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}>
                  <option value="">Pilih invoice</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.id} — {inv.clientName}</option>
                  ))}
                </select>
                {errors.invoiceId && <div className="text-xs text-rose-600 mt-1">{errors.invoiceId}</div>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm">Tanggal Pembayaran *</label>
                  <input type="date" className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm">Metode Pembayaran *</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                  >
                    <option>Transfer Bank</option>
                    <option>Tunai</option>
                    <option>Kartu</option>
                    <option>QRIS</option>
                  </select>
                </div>
              </div>
              {form.method === "Transfer Bank" && (
                <div>
                  <label className="text-sm">Nomor Rekening *</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    value={form.bankAccount || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const found = bankAccounts.find((x) => x.accountNumber === val);
                      setForm({ ...form, bankAccount: val, bankName: found?.bankName || "" });
                    }}
                  >
                    <option value="">Pilih rekening</option>
                    {bankAccounts.map((acc, idx) => (
                      <option key={`${acc.accountNumber}-${idx}`} value={acc.accountNumber}>
                        {acc.bankName} — {acc.accountNumber}{acc.alias ? ` (${acc.alias})` : ""}
                      </option>
                    ))}
                  </select>
                  {errors.bankAccount && <div className="text-xs text-rose-600 mt-1">{errors.bankAccount}</div>}
                </div>
              )}
              <div>
                <label className="text-sm">Jumlah Pembayaran *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  value={amountText}
                  onChange={(e) => {
                    const raw = e.target.value;
                    // Ambil hanya digit
                    const digits = raw.replace(/[^0-9]/g, "");
                    const num = digits ? Number(digits) : 0;
                    setForm({ ...form, amount: num });
                    // Format dengan pemisah ribuan
                    const formatted = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(num);
                    setAmountText(formatted);
                  }}
                  onBlur={() => {
                    const formatted = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(form.amount || 0);
                    setAmountText(formatted);
                  }}
                  placeholder="250,000"
                />
                {errors.amount && <div className="text-xs text-rose-600 mt-1">{errors.amount}</div>}
              </div>
              <div>
                <label className="text-sm">Catatan</label>
                <textarea rows={3} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              <div className="flex items-center justify-end gap-2 mt-2">
                <button className="px-3 py-2 rounded-xl border border-black/10" onClick={() => setModalOpen(false)}>Batal</button>
                <button className="px-3 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white" onClick={savePayment}>Simpan</button>
              </div>
            </div>
          </SoftCard>
        </div>
      )}
    </div>
  );
}