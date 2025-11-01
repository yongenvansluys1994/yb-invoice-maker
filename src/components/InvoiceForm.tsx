"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Invoice, InvoiceItem, InvoiceStatus } from "@/types/invoice";
import { getSettings, formatCurrency } from "@/lib/settings";
import SoftCard from "./SoftCard";
import { useRouter } from "next/navigation";

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

type Product = { id: string; name: string; description?: string; price: number; taxRate?: number };

export default function InvoiceForm({ initial, onSubmit }: { initial?: Invoice; onSubmit: (data: Invoice, ctx?: { email?: string }) => Promise<void> | void }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const settings = getSettings();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [date, setDate] = useState<string>(initial?.date ?? today);
  const [dueDate, setDueDate] = useState<string>(initial?.dueDate ?? addDays(initial?.date ?? today, 30));
  const [clientName, setClientName] = useState<string>(initial?.clientName ?? "");
  const [customerId, setCustomerId] = useState<string | undefined>(initial?.customerId);
  const [status] = useState<InvoiceStatus>(initial?.status ?? "terkirim");
  const [note, setNote] = useState<string>(initial?.note ?? "");
  const [items, setItems] = useState<InvoiceItem[]>(initial?.items ?? []);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; company?: string; email?: string }>>([]);
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductByItem, setSelectedProductByItem] = useState<Record<string, string | undefined>>({});
  const [extraDescByItem, setExtraDescByItem] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDueDate(addDays(date || today, 30));
  }, [date]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/customers");
        const list = await res.json();
        setCustomers(list || []);
      } catch {}
    })();
    (async () => {
      try {
        const res = await fetch("/api/products");
        const list: Product[] = await res.json();
        setProducts(list || []);
      } catch {}
    })();
  }, []);

  // Pisahkan 'Nama Item' vs 'Deskripsi' ketika masuk mode edit
  // Contoh format gabungan yang disimpan: "Nama Item — Deskripsi tambahan"
  useEffect(() => {
    if (!initial || !initial.items || initial.items.length === 0) return;
    const nextExtra: Record<string, string> = {};
    let changed = false;

    const splitDescription = (desc?: string): { base: string; extra: string } => {
      const d = (desc || "").trim();
      if (!d) return { base: "", extra: "" };
      // Prefer delimiter em dash surrounded by spaces
      const marker = " — ";
      if (d.includes(marker)) {
        const parts = d.split(marker);
        const base = (parts.shift() || "").trim();
        const extra = parts.join(marker).trim();
        return { base, extra };
      }
      // Fallback: pisah berdasarkan baris baru
      if (d.includes("\n")) {
        const lines = d.split("\n");
        const base = (lines.shift() || "").trim();
        const extra = lines.join("\n").trim();
        return { base, extra };
      }
      return { base: d, extra: "" };
    };

    setItems((prev) => {
      const next = prev.map((it) => {
        if (!it.description) return it;
        const { base, extra } = splitDescription(it.description);
        if (extra) nextExtra[it.id] = extra;
        if (base !== it.description) {
          changed = true;
          return { ...it, description: base };
        }
        return it;
      });
      return changed ? next : prev;
    });

    if (Object.keys(nextExtra).length) {
      setExtraDescByItem((prev) => ({ ...prev, ...nextExtra }));
    }
  }, [initial]);

  // Prefill email pelanggan saat edit: ketika daftar pelanggan sudah dimuat dan
  // customerId dari invoice tersedia, isi field email dengan email pelanggan.
  useEffect(() => {
    if (!customerId) return;
    const c = customers.find((x) => x.id === customerId);
    if (c && !customerEmail) {
      setCustomerEmail(c.email || "");
    }
  }, [customers, customerId]);

  const subtotalBase = useMemo(() => {
    return items.reduce((sum, it) => {
      const base = (it.unitPrice || 0) * (it.quantity || 0);
      return sum + base;
    }, 0);
  }, [items]);
  const ppnRate = typeof settings.defaultTaxRate === "number" ? settings.defaultTaxRate : 0;
  const pphRate = typeof (settings as any).defaultPphRate === "number" ? (settings as any).defaultPphRate : 1.5;
  const ppnAmount = useMemo(() => Math.round(subtotalBase * (ppnRate / 100)), [subtotalBase, ppnRate]);
  const pphAmount = useMemo(() => Math.round(subtotalBase * (pphRate / 100)), [subtotalBase, pphRate]);
  const total = useMemo(() => subtotalBase + ppnAmount - pphAmount, [subtotalBase, ppnAmount, pphAmount]);

  const [invoiceId, setInvoiceId] = useState<string>(initial?.id ?? "");
  useEffect(() => {
    if (initial?.id) return; // editing mode, keep existing id
    const d = (date || today);
    (async () => {
      try {
        const res = await fetch(`/api/invoices/next-id?date=${encodeURIComponent(d)}`, { credentials: "include" });
        if (res.ok) {
          const json = await res.json();
          if (json?.id) {
            setInvoiceId(json.id);
            return;
          }
        }
      } catch {}
      try {
        // Fallback lokal jika gagal ambil dari server (mis. belum login)
        const { generateInvoiceId } = await import("@/lib/settings");
        setInvoiceId(generateInvoiceId(d));
      } catch {}
    })();
  }, [date, initial?.id, today]);

  const buildPayload = (statusOverride?: InvoiceStatus): Invoice => {
    const itemsFinal = items.map((it) => {
      const extra = (extraDescByItem[it.id] || "").trim();
      const base = (it.description || "").trim();
      const desc = extra ? `${base}${base ? " — " : ""}${extra}` : base;
      return { ...it, description: desc };
    });
    return {
      id: invoiceId || initial?.id || "",
      clientName,
      date,
      dueDate,
      status: statusOverride ?? status,
      note: note || undefined,
      items: itemsFinal,
      total,
      customerId,
    };
  };

  const addItem = () => {
    const newItem: InvoiceItem = { id: crypto.randomUUID(), description: "", unitPrice: 0, quantity: 1 };
    setItems((prev) => [...prev, newItem]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const selectProduct = (idx: number, itemId: string, productId?: string) => {
    setSelectedProductByItem((prev) => ({ ...prev, [itemId]: productId }));
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, description: p.name, unitPrice: p.price } : it)));
    setExtraDescByItem((prev) => ({ ...prev, [itemId]: p.description || "" }));
  };

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
          const sel = customers.find((c) => c.id === customerId);
          const email = (customerEmail || sel?.email || "").trim() || undefined;
          await onSubmit(buildPayload(), { email });
        } finally {
          setSubmitting(false);
        }
      }}
      className="grid gap-4"
    >
      {/* Header Title handled in page; form sections below */}

      <SoftCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium text-black/70">Detail Invoice</div>
            <div className="text-xs text-black/60">Lengkapi detail invoice di bawah ini</div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-sm">Pelanggan <span className="text-red-500">*</span></label>
            <select
              value={customerId || ""}
              onChange={(e) => {
                const id = e.target.value || undefined;
                setCustomerId(id);
                const c = customers.find((x) => x.id === id);
                if (c) {
                  setClientName(c.name || clientName);
                  setCustomerEmail(c.email || "");
                }
              }}
              className="rounded-xl border border-black/10 bg-white/80 px-3 py-2"
            >
              <option value="">Pilih pelanggan</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.company}{c.company ? "" : ""}</option>
              ))}
              </select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm">Email</label>
            <input
              type="email"
              placeholder="Email pelanggan"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="rounded-xl border border-black/10 bg-white/80 px-3 py-2"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm">Tanggal Invoice <span className="text-red-500">*</span></label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-black/10 bg-white/80 px-3 py-2" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm">Tanggal Jatuh Tempo <span className="text-red-500">*</span></label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl border border-black/10 bg-white/80 px-3 py-2" />
          </div>
        </div>
        {/* Ringkasan Pajak Global di bawah tanggal */}
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl border border-black/10 bg-white/70 p-3">
            <div className="text-xs text-black/60">Pajak PPN ({ppnRate}%)</div>
            <div className="text-violet-600 font-semibold">{mounted ? formatCurrency(ppnAmount) : Math.round(ppnAmount || 0)}</div>
          </div>
          <div className="rounded-xl border border-black/10 bg-white/70 p-3 text-right">
            <div className="text-xs text-black/60">PPh ({pphRate}%)</div>
            <div className="text-violet-600 font-semibold">{mounted ? formatCurrency(pphAmount) : Math.round(pphAmount || 0)}</div>
          </div>
        </div>
      </SoftCard>

      <SoftCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-black/70">Item Invoice</div>
          <button type="button" onClick={addItem} className="rounded-xl border border-black/10 bg-white/80 px-3 py-2">+ Tambah Item</button>
        </div>

        {items.map((it, idx) => {
          const base = (it.unitPrice || 0) * (it.quantity || 0);
          const subtotal = base;
          return (
            <div key={it.id} className="mb-4 border-t border-black/10 pt-4">
              <div className="grid gap-2 mb-2">
                <label className="text-sm">Pilih Produk (Opsional)</label>
                <select
                  value={selectedProductByItem[it.id] || ""}
                  onChange={(e) => selectProduct(idx, it.id, e.target.value || undefined)}
                  className="rounded-xl border border-black/10 bg-white/80 px-3 py-2"
                >
                  <option value="">Pilih dari produk</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-2 mb-2">
                <div className="grid gap-2">
                  <label className="text-sm">Nama Item <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={it.description}
                    onChange={(e) => setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, description: e.target.value } : p)))}
                    className="rounded-xl border border-black/10 bg-white/80 px-3 py-2"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm">Deskripsi</label>
                  <input
                    type="text"
                    placeholder="Deskripsi produk"
                    value={extraDescByItem[it.id] || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExtraDescByItem((prev) => ({ ...prev, [it.id]: val }));
                    }}
                    className="rounded-xl border border-black/10 bg-white/80 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-2">
                <div className="grid gap-2">
                  <label className="text-sm">Jumlah <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={it.quantity}
                    onChange={(e) => setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, quantity: Number(e.target.value) } : p)))}
                    className="rounded-xl border border-black/10 bg-white/80 px-3 py-2"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm">Harga Satuan <span className="text-red-500">*</span></label>
                  <input
                    inputMode="numeric"
                    value={new Intl.NumberFormat('en-US').format(Number(it.unitPrice || 0))}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, "");
                      const num = Number(digits || 0);
                      setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, unitPrice: num } : p)));
                    }}
                    className="rounded-xl border border-black/10 bg-white/80 px-3 py-2"
                  />
                </div>
                <div className="grid gap-2 items-end justify-end text-right">
                  <div className="text-xs text-black/60">Subtotal Item</div>
                  <div className="text-violet-600 font-semibold">{mounted ? formatCurrency(subtotal) : Math.round(subtotal || 0)}</div>
                </div>
              </div>
              <div className="flex justify-end mt-2">
                <button type="button" className="rounded-xl border border-red-200 text-red-600 px-3 py-2" onClick={() => removeItem(idx)}>Hapus</button>
              </div>
            </div>
          );
        })}

        {items.length === 0 ? (
          <div className="text-sm text-black/60">Belum ada item. Klik "Tambah Item" di kanan atas.</div>
        ) : null}
      </SoftCard>

      <SoftCard className="p-6">
        <div className="grid gap-2">
          <label className="text-sm">Catatan</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className="rounded-xl border border-black/10 bg-white/80 px-3 py-2" rows={4} placeholder="Catatan untuk invoice (opsional)" />
        </div>
      </SoftCard>

      <div className="soft-card p-6">
        <div className="grid md:grid-cols-2 gap-2 mb-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-black/70">Subtotal</div>
            <div className="text-violet-700 font-semibold">{mounted ? formatCurrency(subtotalBase) : Math.round(subtotalBase || 0)}</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-black/70">PPN ({ppnRate}%)</div>
            <div className="text-violet-700 font-semibold">{mounted ? formatCurrency(ppnAmount) : Math.round(ppnAmount || 0)}</div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-black/70">PPh ({pphRate}%)</div>
            <div className="text-violet-700 font-semibold">{mounted ? formatCurrency(pphAmount) : Math.round(pphAmount || 0)}</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Total Invoice</div>
            <div className="text-violet-700 font-semibold">{mounted ? formatCurrency(total) : Math.round(total || 0)}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 disabled:opacity-50" onClick={() => router.push("/invoices")} disabled={submitting}>Batal</button>
        <button
          type="button"
          className="rounded-xl border border-black/10 bg-white px-3 py-2 disabled:opacity-50 flex items-center gap-2"
          onClick={async (e) => {
            e.preventDefault();
            if (submitting) return;
            setSubmitting(true);
            try {
              await onSubmit(buildPayload("draft"));
            } finally {
              setSubmitting(false);
            }
          }}
          disabled={submitting}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Simpan Draft
        </button>
        <button
          type="submit"
          className="rounded-xl bg-violet-600 text-white px-3 py-2 disabled:opacity-50 flex items-center gap-2"
          disabled={submitting}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Kirim Invoice
        </button>
      </div>
    </form>
  );
}