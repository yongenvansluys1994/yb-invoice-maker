"use client";
import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, MapPin, Search, Pencil, Trash2, X, Loader2 } from "lucide-react";
import SoftCard from "@/components/SoftCard";
import { toast } from "@/lib/toast";

interface Customer {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  active?: boolean;
}

const SAMPLE_CUSTOMERS: Customer[] = [
  {
    id: "c-pt-teknologi-maju",
    name: "PT Teknologi Maju",
    company: "PT Teknologi Maju",
    email: "info@tekmaju.com",
    phone: "021-1234567",
    address: "Jl. Sudirman No. 123, Jakarta",
    active: true,
  },
  {
    id: "c-cv-digital-kreatif",
    name: "CV Digital Kreatif",
    company: "CV Digital Kreatif",
    email: "contact@digitalkreatif.id",
    phone: "021-7654321",
    address: "Jl. Thamrin No. 45, Jakarta",
    active: true,
  },
  {
    id: "c-john-doe",
    name: "John Doe",
    company: "",
    email: "john@example.com",
    phone: "0812-3456-7890",
    address: "Jl. Gatot Subroto No. 67, Jakarta",
    active: true,
  },
];

export default function PelangganPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Customer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  // Fetch from API and one-time import localStorage customers into DB
  useEffect(() => {
    async function loadCustomers() {
      setLoading(true);
      try {
        const res = await fetch("/api/customers");
        const dbItems: Customer[] = await res.json();
        // One-time migration from localStorage -> DB
        const migrated = localStorage.getItem("invgenz:customersMigrated") === "1";
        const stored: Customer[] = JSON.parse(localStorage.getItem("invgenz:customers") || "[]");
        if (!migrated && stored.length) {
          // Only import those not already present by id
          const existingIds = new Set(dbItems.map((c) => c.id));
          for (const c of stored) {
            if (!existingIds.has(c.id)) {
              try {
                await fetch("/api/customers", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: c.id,
                    name: c.name,
                    company: c.company || undefined,
                    email: c.email || undefined,
                    phone: c.phone || undefined,
                    address: c.address || undefined,
                    taxId: c.taxId || undefined,
                  }),
                });
              } catch {}
            }
          }
          localStorage.setItem("invgenz:customersMigrated", "1");
          // Reload from API after import
          try {
            const res2 = await fetch("/api/customers");
            const dbItems2: Customer[] = await res2.json();
            setItems(dbItems2);
            return;
          } catch {}
        }
        setItems(dbItems);
      } catch {
        // Fallback to sample if API fails
        setItems(SAMPLE_CUSTOMERS);
      } finally {
        setLoading(false);
      }
    }
    loadCustomers();
  }, []);

  const customers = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((c) =>
      [c.name, c.company ?? "", c.email ?? "", c.phone ?? "", c.address ?? ""].some((f) => f.toLowerCase().includes(q))
    );
  }, [query, items]);

  useEffect(() => {
    setPage(1);
  }, [query, items]);

  const totalPages = Math.max(1, Math.ceil(customers.length / pageSize));
  const visibleCustomers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return customers.slice(start, start + pageSize);
  }, [customers, page, pageSize]);

  async function saveCustomer() {
    if (!form.name.trim()) {
      setError("Nama Pelanggan wajib diisi");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch("/api/customers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            name: form.name.trim(),
            company: form.company.trim() || undefined,
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            address: form.address.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(err?.error || "Gagal menyimpan pelanggan");
          toast.error("Gagal menyimpan pelanggan");
          return;
        }
        const updated: Customer = await res.json();
        setItems((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        toast.success("Pelanggan berhasil diperbarui");
      } else {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            company: form.company.trim() || undefined,
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            address: form.address.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(err?.error || "Gagal menyimpan pelanggan");
          toast.error("Gagal menyimpan pelanggan");
          return;
        }
        const created: Customer = await res.json();
        setItems((prev) => [created, ...prev]);
        toast.success("Pelanggan berhasil ditambahkan");
      }
      setShowModal(false);
      setForm({ name: "", company: "", email: "", phone: "", address: "", notes: "" });
      setEditingId(null);
    } catch {
      setError("Gagal menyimpan pelanggan");
    } finally {
      setSaving(false);
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm({ name: "", company: "", email: "", phone: "", address: "", notes: "" });
    setShowModal(true);
  }

  function openEdit(c: Customer) {
    setEditingId(c.id);
    setForm({ name: c.name || "", company: c.company || "", email: c.email || "", phone: c.phone || "", address: c.address || "", notes: "" });
    setShowModal(true);
  }

  async function removeCustomer(id: string) {
    const ok = window.confirm("Yakin menghapus pelanggan ini?");
    if (!ok) return;
    setRemovingId(id);
    try {
      const res = await fetch("/api/customers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((c) => c.id !== id));
        toast.success("Pelanggan berhasil dihapus");
      } else {
        toast.error("Gagal menghapus pelanggan");
      }
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Pelanggan</h2>
          <p className="text-sm text-black/60">Kelola data pelanggan Anda</p>
        </div>
        <button
          onClick={() => openAdd()}
          className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white text-sm px-3 py-2 rounded-xl shadow-sm"
          disabled={loading}
        >
          <span className="text-lg leading-none">＋</span>
          Tambah Pelanggan
        </button>
      </div>

      <div className="soft-card p-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari pelanggan..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-black/10 bg-white/70 dark:bg-white/5 text-sm outline-none"
          />
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
          {visibleCustomers.map((c) => (
            <SoftCard key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-semibold">{c.name}</div>
                  {c.company ? <div className="text-xs text-black/60 mt-1">{c.company}</div> : null}
                </div>
                {c.active ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-black/10 text-black/60">Aktif</span>
                ) : null}
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-black/50" />
                  <span>{c.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-black/50" />
                  <span>{c.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-black/50" />
                  <span>{c.address}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-black/10 bg-white/70 dark:bg-white/5 disabled:opacity-50" onClick={() => openEdit(c)} disabled={!!removingId}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button className="p-2 rounded-lg hover:bg-black/5 text-black/60 disabled:opacity-50" aria-label="Delete" onClick={() => removeCustomer(c.id)} disabled={removingId === c.id}>
                  {removingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
            <div className="text-xl font-semibold mb-4">{editingId ? "Edit Pelanggan" : "Tambah Pelanggan"}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-black/60">Nama Pelanggan *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-black/10 bg-white/70 dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="text-xs text-black/60">Nama Perusahaan</label>
                <input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-black/10 bg-white/70 dark:bg-white/5 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-black/60">Email</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-black/10 bg-white/70 dark:bg-white/5 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-black/60">Telepon</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-black/10 bg-white/70 dark:bg-white/5 text-sm outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-black/60">Alamat</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-black/10 bg-white/70 dark:bg-white/5 text-sm outline-none"
                  rows={3}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-black/60">Catatan</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-black/10 bg-white/70 dark:bg-white/5 text-sm outline-none"
                  rows={3}
                />
              </div>
            </div>
            {error && <div className="mt-3 text-xs text-rose-600">{error}</div>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="px-3 py-2 rounded-xl border border-black/10 disabled:opacity-50" onClick={() => setShowModal(false)} disabled={saving}>Batal</button>
              <button className="px-3 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white disabled:opacity-50 flex items-center gap-2" onClick={saveCustomer} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}