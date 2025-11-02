"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Pencil, Trash2, X, Loader2 } from "lucide-react";
import SoftCard from "@/components/SoftCard";
import { toast } from "@/lib/toast";
import { formatCurrency, getSettings } from "@/lib/settings";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  unit?: "paket" | "jam" | "pcs" | "bulan" | string;
  taxRate: number; // percent
  active?: boolean;
}

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: "p-website-dev",
    name: "Website Development",
    description: "Pembuatan website company profile",
    price: 15000000,
    unit: "paket",
    taxRate: 11,
    active: true,
  },
  {
    id: "p-mobile-app",
    name: "Mobile App Development",
    description: "Pembuatan aplikasi mobile iOS & Android",
    price: 25000000,
    unit: "paket",
    taxRate: 11,
    active: true,
  },
  {
    id: "p-uiux",
    name: "UI/UX Design",
    description: "Desain antarmuka dan pengalaman pengguna",
    price: 5000000,
    unit: "paket",
    taxRate: 11,
    active: true,
  },
  {
    id: "p-consulting",
    name: "Konsultasi IT",
    description: "Konsultasi teknologi informasi per jam",
    price: 500000,
    unit: "jam",
    taxRate: 2,
    active: true,
  },
];

export default function ProdukPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: 0,
    unit: "paket" as Product["unit"],
    taxRate: getSettings().defaultTaxRate,
    active: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/products", { credentials: "include" });
        if (res.ok) {
          const list: unknown = await res.json();
          setItems(Array.isArray(list) ? (list as Product[]) : []);
        } else {
          throw new Error("Failed to fetch products");
        }
      } catch {
        const stored = JSON.parse(localStorage.getItem("invgenz:products") || "[]");
        if (stored.length) setItems(stored);
        else setItems(SAMPLE_PRODUCTS);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const products = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((p) =>
      [p.name, p.description, p.unit, String(p.taxRate)].some((f) => f && f.toLowerCase().includes(q))
    );
  }, [query, items]);

  useEffect(() => {
    setPage(1);
  }, [query, items]);

  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  const visibleProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return products.slice(start, start + pageSize);
  }, [products, page, pageSize]);

  function openAdd() {
    setEditingId(null);
    setForm({ name: "", description: "", price: 0, unit: "paket", taxRate: getSettings().defaultTaxRate, active: true });
    setError(null);
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setForm({ name: p.name, description: p.description, price: p.price, unit: p.unit, taxRate: p.taxRate, active: !!p.active });
    setError(null);
    setShowModal(true);
  }

  async function remove(id: string) {
    const ok = window.confirm("Yakin menghapus produk ini?");
    if (!ok) return;
    setRemovingId(id);
    try {
      const res = await fetch("/api/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((x) => x.id !== id));
        toast.success("Produk berhasil dihapus");
      } else {
        toast.error("Gagal menghapus produk");
      }
    } finally {
      setRemovingId(null);
    }
  }

  async function save() {
    if (!form.name.trim()) { setError("Nama Produk wajib diisi"); return; }
    if (!form.price || form.price <= 0) { setError("Harga harus lebih dari 0"); return; }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const res = await fetch("/api/products", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, name: form.name.trim(), description: form.description.trim(), price: Number(form.price), unit: form.unit, taxRate: Number(form.taxRate), active: form.active }),
        });
        if (res.ok) {
          const updated: Product = await res.json();
          setItems((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
          toast.success("Produk berhasil diperbarui");
        } else {
          const err = await res.json().catch(() => ({}));
          setError(err?.error || "Gagal menyimpan");
          toast.error("Gagal menyimpan produk");
          return;
        }
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name.trim(), description: form.description.trim(), price: Number(form.price), unit: form.unit, taxRate: Number(form.taxRate), active: form.active }),
        });
        if (res.ok) {
          const created: Product = await res.json();
          setItems((prev) => [created, ...prev]);
          toast.success("Produk berhasil ditambahkan");
        } else {
          const err = await res.json().catch(() => ({}));
          setError(err?.error || "Gagal menyimpan");
          toast.error("Gagal menyimpan produk");
          return;
        }
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Produk / Jasa</h2>
          <p className="text-sm text-black/60">Kelola produk dan jasa yang Anda tawarkan</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white text-sm px-3 py-2 rounded-xl shadow-sm" disabled={loading}>
          <span className="text-lg leading-none">＋</span>
          Tambah Produk
        </button>
      </div>

      <div className="soft-card p-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari produk/jasa..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-black/10 bg-white/70 dark:bg-white/5 text-sm outline-none" />
        </div>
      </div>

      {loading ? (
        <SoftCard className="p-4 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Sedang memuat data...</span>
        </SoftCard>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProducts.map((p) => (
            <SoftCard key={p.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-semibold">{p.name}</div>
                  <div className="text-xs text-black/60 mt-1">{p.description}</div>
                </div>
                {p.active ? <span className="text-xs px-2 py-1 rounded-full bg-violet-100 text-violet-700">Aktif</span> : null}
              </div>

              <div className="mt-3 text-sm">
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold text-violet-700">{formatCurrency(p.price)}</div>
                  <span className="text-black/60">/ {p.unit || "paket"}</span>
                </div>
                <div className="mt-2"><span className="text-xs px-2 py-1 rounded-lg bg-black/10 text-black/60">PPN {p.taxRate}%</span></div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <input disabled placeholder="" className="flex-1 px-3 py-1.5 rounded-lg border border-black/10 bg-white/70 dark:bg-white/5 text-sm" />
                <button className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-black/10 bg-white/70 dark:bg-white/5" onClick={() => openEdit(p)} disabled={!!removingId}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button className="p-2 rounded-lg hover:bg-black/5 text-black/60 disabled:opacity-50" aria-label="Delete" onClick={() => remove(p.id)} disabled={removingId === p.id}>
                  {removingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </SoftCard>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">Tampilkan</span>
            <select
              className="text-sm rounded-lg border border-black/10 px-2 py-1 bg-white/70 dark:bg-white/5"
              value={pageSize}
              onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}
            >
              <option value={6}>6</option>
              <option value={9}>9</option>
              <option value={12}>12</option>
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
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="soft-card p-4 w-full max-w-2xl relative">
            <button className="absolute right-3 top-3 p-2 rounded-lg hover:bg-black/5" onClick={() => setShowModal(false)} aria-label="Tutup">
              <X className="h-4 w-4" />
            </button>
            <div className="text-xl font-semibold mb-4">{editingId ? "Edit Produk" : "Tambah Produk"}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-black/60">Nama Produk *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl border border-black/10 bg-white/70 dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <div>
                <label className="text-xs text-black/60">Satuan</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as any })} className="w-full mt-1 px-3 py-2 rounded-xl border border-black/10 bg-white/70 dark:bg-white/5 text-sm outline-none">
                  <option value="paket">paket</option>
                  <option value="jam">jam</option>
                  <option value="pcs">pcs</option>
                  <option value="bulan">bulan</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-black/60">Deskripsi</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full mt-1 px-3 py-2 rounded-xl border border-black/10 bg-white/70 dark:bg-white/5 text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs text-black/60">Harga</label>
                <input inputMode="numeric" value={new Intl.NumberFormat('en-US').format(Number(form.price || 0))} onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, "");
                  const num = Number(digits || 0);
                  setForm({ ...form, price: num });
                }} className="w-full mt-1 px-3 py-2 rounded-xl border border-black/10 bg-white/70 dark:bg-white/5 text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs text-black/60">PPN %</label>
                <input type="number" min={0} max={100} value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-xl border border-black/10 bg-white/70 dark:bg-white/5 text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs text-black/60">Status</label>
                <select value={form.active ? "aktif" : "nonaktif"} onChange={(e) => setForm({ ...form, active: e.target.value === "aktif" })} className="w-full mt-1 px-3 py-2 rounded-xl border border-black/10 bg-white/70 dark:bg-white/5 text-sm outline-none">
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </div>
            </div>
            {error && <div className="mt-3 text-xs text-rose-600">{error}</div>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="px-3 py-2 rounded-xl border border-black/10 disabled:opacity-50" onClick={() => setShowModal(false)} disabled={saving}>Batal</button>
              <button className="px-3 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white disabled:opacity-50 flex items-center gap-2" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingId ? "Simpan" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}