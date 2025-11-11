"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fetchSettings } from "@/lib/settings";
import SoftCard from "@/components/SoftCard";
import { toast } from "@/lib/toast";
import { Loader2 } from "lucide-react";

type AppSettings = {
  companyName?: string;
  logoUrl?: string;
  bankName?: string;
  bankAccount?: string;
  bankAccounts?: { bankName: string; accountNumber: string; alias?: string }[];
  ownerName?: string;
  ownerTitle?: string;
  invoicePrefix?: string;
  defaultTaxRate?: number;
  defaultPphRate?: number;
  currency?: string;
  language?: string;
  themeKey?: string;
  address?: string;
  npwp?: string;
  smtpEmail?: string;
  smtpAppPassword?: string;
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem("invgenz:settings") || "{}";
    const s = JSON.parse(raw);
    // Hanya ambil field yang diizinkan dari localStorage
    const merged: AppSettings = {
      companyName: "YB Invoice Maker",
      logoUrl: s.logoUrl ?? "",
      bankName: "",
      bankAccount: "",
      bankAccounts: [],
      ownerName: "",
      ownerTitle: "",
      invoicePrefix: (s.invoicePrefix ?? "INV") as any,
      defaultTaxRate: (typeof s.defaultTaxRate === "number" ? s.defaultTaxRate : 11) as any,
      defaultPphRate: (typeof s.defaultPphRate === "number" ? s.defaultPphRate : 1.5) as any,
      currency: (s.currency ?? "IDR") as any,
      language: (s.language ?? "id-ID") as any,
      themeKey: (s.themeKey ?? "pastel1") as any,
      smtpEmail: "",
      smtpAppPassword: "",
    } as AppSettings;
    // Sinkronisasi backward compatibility
    if ((merged.bankAccounts?.length || 0) > 0) {
      merged.bankName = merged.bankAccounts![0].bankName;
      merged.bankAccount = merged.bankAccounts![0].accountNumber;
    } else if (merged.bankName && merged.bankAccount) {
      merged.bankAccounts = [ { bankName: merged.bankName, accountNumber: merged.bankAccount, alias: "Utama" } ];
    }
    return merged;
  } catch { return { companyName: "YB Invoice Maker", invoicePrefix: "INV", defaultTaxRate: 11, defaultPphRate: 1.5, currency: "IDR", language: "id-ID", themeKey: "pastel1" }; }
}

function applyTheme(key: string) {
  const root = document.documentElement;
  const themes: Record<string, { start: string; end: string }> = {
    pastel1: { start: "#fbcfe8", end: "#bfdbfe" },
    pastel2: { start: "#e9d5ff", end: "#a7f3d0" },
    pastel3: { start: "#fde68a", end: "#c4b5fd" },
  };
  const t = themes[key] || themes.pastel1;
  root.style.setProperty("--pastel-start", t.start);
  root.style.setProperty("--pastel-end", t.end);
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [saving, setSaving] = useState(false);
  const [loadingServer, setLoadingServer] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoadingServer(true);
        const server = await fetchSettings();
        // Gabungkan beberapa field dari lokal jika server kosong (untuk menjaga nilai yang pernah disimpan lokal)
        const localRaw = localStorage.getItem("invgenz:settings") || "{}";
        const local = JSON.parse(localRaw) as AppSettings;
        let next: AppSettings = { ...server } as AppSettings;

        // Overlay logo jika server kosong
        if ((next.logoUrl ?? "") === "" && (local.logoUrl ?? "") !== "") {
          next.logoUrl = local.logoUrl as string;
        }
        // Jangan ambil dari lokal untuk field lain; hanya yang dikecualikan di bawah

        // Selalu ambil dari lokal/default untuk bidang yang dikecualikan dari DB
        const localDefaults = loadSettings();
        const excludedKeys: (keyof AppSettings)[] = ["currency", "language", "themeKey", "defaultTaxRate"];
        // Sertakan defaultPphRate agar tetap konsisten dari lokal jika server kosong
        excludedKeys.push("defaultPphRate");
        excludedKeys.forEach((k) => {
          (next as any)[k] = (local[k] ?? (localDefaults as any)[k]);
        });

        setSettings(next);
          try {
            const allowedLocal: Partial<AppSettings> = {
              logoUrl: next.logoUrl,
              currency: next.currency,
              language: next.language,
              themeKey: next.themeKey,
              invoicePrefix: next.invoicePrefix,
              defaultTaxRate: next.defaultTaxRate,
              defaultPphRate: next.defaultPphRate,
            };
            localStorage.setItem("invgenz:settings", JSON.stringify(allowedLocal));
          } catch {}
        applyTheme(String(next.themeKey || "pastel1"));
        setLoadingServer(false);
      } catch {
        // fallback ke local
        const next = loadSettings();
        setSettings(next);
        applyTheme(String(next.themeKey || "pastel1"));
        setLoadingServer(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const toSave = { ...settings };
      // Pastikan field legacy ikut tersimpan dari akun pertama
      if ((toSave.bankAccounts?.length || 0) > 0) {
        toSave.bankName = toSave.bankAccounts![0].bankName;
        toSave.bankAccount = toSave.bankAccounts![0].accountNumber;
      }

      // Simpan ke server untuk semua field inti termasuk owner, daftar rekening, dan logo
      const payload = {
        companyName: toSave.companyName || "YB Invoice Maker",
        logoUrl: toSave.logoUrl || "",
        bankName: toSave.bankName || "Bank BCA",
        bankAccount: toSave.bankAccount || "1234567890",
        address: toSave.address || "",
        npwp: toSave.npwp || "",
        invoicePrefix: toSave.invoicePrefix || "INV",
        defaultTaxRate: typeof toSave.defaultTaxRate === "number" ? toSave.defaultTaxRate : 11,
        defaultPphRate: typeof toSave.defaultPphRate === "number" ? toSave.defaultPphRate : 1.5,
        currency: toSave.currency || "IDR",
        language: toSave.language || "id-ID",
        themeKey: toSave.themeKey || "pastel1",
        ownerName: toSave.ownerName || "",
        ownerTitle: toSave.ownerTitle || "",
        smtpEmail: toSave.smtpEmail || "",
        smtpAppPassword: toSave.smtpAppPassword || "",
        bankAccounts: (toSave.bankAccounts || []).map(a => ({ bankName: a.bankName, accountNumber: a.accountNumber, alias: a.alias || undefined })),
      };

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Ambil pesan error dari server
        let errorMsg = "Gagal menyimpan ke server";
        try {
          const contentType = res.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            const errData = await res.json();
            if (errData.error) {
              errorMsg = errData.error;
            } else {
              errorMsg = `Error ${res.status}: ${res.statusText}`;
            }
          } else {
            // Response bukan JSON (mungkin HTML error page)
            const text = await res.text();
            console.error("Non-JSON response:", text);
            errorMsg = `Error ${res.status}: Server mengembalikan response yang tidak valid`;
          }
        } catch (e) {
          console.error("Error parsing response:", e);
          errorMsg = `Error ${res.status}: ${res.statusText}`;
        }
        toast.error(errorMsg);
        return;
      }

      // Parse response dengan safety check
      let savedData;
      try {
        const contentType = res.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          savedData = await res.json();
        } else {
          console.warn("Success response is not JSON");
        }
      } catch (e) {
        console.error("Error parsing success response:", e);
        // Tetap lanjut karena operasi mungkin berhasil di server
      }

      // Jika berhasil simpan ke server, baru simpan ke localStorage untuk field tertentu
      try {
        const allowedLocal: Partial<AppSettings> = {
          logoUrl: toSave.logoUrl,
          currency: toSave.currency,
          language: toSave.language,
          themeKey: toSave.themeKey,
          invoicePrefix: toSave.invoicePrefix,
          defaultTaxRate: toSave.defaultTaxRate,
          defaultPphRate: toSave.defaultPphRate,
        };
        localStorage.setItem("invgenz:settings", JSON.stringify(allowedLocal));
      } catch {}

      applyTheme(settings.themeKey || "pastel1");
      toast.success("Pengaturan berhasil disimpan");
    } catch (err) {
      // Network error atau error lainnya
      console.error("Save settings error:", err);
      let errorMsg = "Terjadi kesalahan tidak terduga";
      if (err instanceof Error) {
        errorMsg = err.message;
        // Jika error JSON parsing, berikan pesan yang lebih jelas
        if (errorMsg.includes("JSON") || errorMsg.includes("token")) {
          errorMsg = "Server mengembalikan response yang tidak valid. Cek koneksi atau coba lagi.";
        }
      }
      toast.error(errorMsg);
    } finally {
      // Minimum delay untuk UX yang baik
      await new Promise((r) => setTimeout(r, 300));
      setSaving(false);
    }
  }

  return (
    <>
      {/* Modal loading menggunakan Portal agar benar-benar fixed ke viewport */}
      {mounted && saving && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            margin: 0,
            padding: 0
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-4 min-w-[280px]">
            <Loader2 className="h-10 w-10 animate-spin text-violet-600" aria-label="Menyimpan" />
            <div className="text-center">
              <div className="font-semibold text-lg">Menyimpan Pengaturan</div>
              <div className="text-sm text-black/60 mt-1">Mohon tunggu sebentar...</div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="grid gap-6">
        {/* Loading saat pertama kali fetch dari server */}
        {loadingServer ? (
          <div className="fixed inset-0 z-50 flex justify-center pt-24 bg-white/60 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-label="Memuat" />
          </div>
        ) : null}

        <div>
          <h2 className="text-2xl font-semibold">Pengaturan</h2>
          <p className="text-sm text-black/60">Kelola pengaturan global aplikasi</p>
        </div>

      {/* Informasi Perusahaan */}
      <SoftCard className="p-6">
        <div className="font-semibold mb-1">Informasi Perusahaan</div>
        <div className="text-xs text-black/60 mb-4">Informasi ini akan muncul di invoice</div>
        <div className="grid gap-3">
          <div>
            <label className="text-sm">Nama Perusahaan</label>
            <input className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2" value={settings.companyName || ""} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} />
          </div>
          <div>
            <label className="text-sm">Alamat Perusahaan</label>
            <textarea className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2" rows={3} placeholder="Masukkan alamat perusahaan" value={settings.address || ""} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
          </div>
          <div>
            <label className="text-sm">Upload Logo Perusahaan</label>
            <input
              type="file"
              accept="image/*"
              className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = String(reader.result || "");
                  setSettings({ ...settings, logoUrl: dataUrl });
                };
                reader.readAsDataURL(file);
              }}
            />
            {settings.logoUrl ? (
              <div className="mt-2 flex items-center gap-3">
                {/* Preview logo */}
                <img src={settings.logoUrl} alt="Logo Perusahaan" className="h-14 w-auto rounded-lg border border-black/10 bg-white/60" />
                <button
                  className="text-xs px-3 py-2 rounded-xl border border-black/10 bg-white/60 hover:bg-white"
                  onClick={() => setSettings({ ...settings, logoUrl: "" })}
                >Hapus Logo</button>
              </div>
            ) : (
              <div className="text-xs text-black/50 mt-1">Unggah file gambar (PNG/JPG/SVG). Logo tersimpan lokal.</div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Nama Pemilik/Pejabat Penandatangan</label>
              <input className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2" value={settings.ownerName || ""} onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })} />
            </div>
            <div>
              <label className="text-sm">Jabatan</label>
              <input className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2" placeholder="Mis. Direktur Utama" value={settings.ownerTitle || ""} onChange={(e) => setSettings({ ...settings, ownerTitle: e.target.value })} />
            </div>
          </div>
        </div>
      </SoftCard>

      {/* Informasi Bank */}
      <SoftCard className="p-6">
        <div className="font-semibold mb-1">Informasi Bank</div>
        <div className="text-xs text-black/60 mb-4">Kelola beberapa rekening bank. Akun pertama dianggap utama.</div>
        <div className="grid gap-4">
          {(settings.bankAccounts || []).map((acc, idx) => (
            <div key={idx} className="grid gap-3 p-3 rounded-xl border border-black/10 bg-white/60">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Rekening #{idx + 1}{idx === 0 ? " • Utama" : ""}</div>
                <button
                  className="text-xs px-2 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => {
                    const next = [...(settings.bankAccounts || [])];
                    next.splice(idx, 1);
                    setSettings({ ...settings, bankAccounts: next });
                  }}
                  disabled={(settings.bankAccounts || []).length <= 1}
                >Hapus</button>
              </div>
              <div>
                <label className="text-sm">Nama Bank</label>
                <input
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2"
                  value={acc.bankName}
                  onChange={(e) => {
                    const next = [...(settings.bankAccounts || [])];
                    next[idx] = { ...acc, bankName: e.target.value };
                    setSettings({ ...settings, bankAccounts: next });
                  }}
                />
              </div>
              <div>
                <label className="text-sm">Nomor Rekening</label>
                <input
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2"
                  value={acc.accountNumber}
                  onChange={(e) => {
                    const next = [...(settings.bankAccounts || [])];
                    next[idx] = { ...acc, accountNumber: e.target.value };
                    setSettings({ ...settings, bankAccounts: next });
                  }}
                />
              </div>
              <div>
                <label className="text-sm">Alias (opsional)</label>
                <input
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2"
                  placeholder="Mis. Operasional, Tabungan"
                  value={acc.alias || ""}
                  onChange={(e) => {
                    const next = [...(settings.bankAccounts || [])];
                    next[idx] = { ...acc, alias: e.target.value };
                    setSettings({ ...settings, bankAccounts: next });
                  }}
                />
              </div>
            </div>
          ))}
          <div>
            <button
              className="rounded-xl px-3 py-2 border border-black/10 bg-white/60 hover:bg-white"
              onClick={() => {
                const next = [...(settings.bankAccounts || [])];
                next.push({ bankName: "", accountNumber: "", alias: "" });
                setSettings({ ...settings, bankAccounts: next });
              }}
            >Tambah Rekening</button>
          </div>
        </div>
      </SoftCard>

      {/* Pengaturan Invoice */}
      <SoftCard className="p-6">
        <div className="font-semibold mb-1">Pengaturan Invoice</div>
        <div className="text-xs text-black/60 mb-4">Format dan pengaturan default invoice</div>
        <div className="grid gap-3">
          <div>
            <label className="text-sm">Prefix Nomor Invoice</label>
            <input className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2" value={settings.invoicePrefix || "INV"} onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value.toUpperCase() })} />
            <div className="text-xs text-black/50 mt-1">Contoh format: {`${settings.invoicePrefix || "INV"}-${new Date().toISOString().slice(0,10).replaceAll("-","")}-001`}</div>
          </div>
          <div>
            <label className="text-sm">Tarif Ppn (%)</label>
            <input type="number" min={0} max={100} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2" value={settings.defaultTaxRate ?? 11} onChange={(e) => setSettings({ ...settings, defaultTaxRate: Number(e.target.value) || 0 })} />
            <div className="text-xs text-black/50 mt-1">Tarif pajak yang akan digunakan secara default</div>
          </div>
          <div>
            <label className="text-sm">Tarif PPh (%)</label>
            <input type="number" step="0.1" min={0} max={100} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2" value={typeof settings.defaultPphRate === "number" ? settings.defaultPphRate : 1.5} onChange={(e) => setSettings({ ...settings, defaultPphRate: Number(e.target.value) || 0 })} />
            <div className="text-xs text-black/50 mt-1">Biasanya 1.5% (PPh). Diambil sebagai pajak withholding.</div>
          </div>
        </div>
      </SoftCard>

      {/* Pengaturan Email (SMTP) */}
      <SoftCard className="p-6">
        <div className="font-semibold mb-1">Pengaturan Email (SMTP)</div>
        <div className="text-xs text-black/60 mb-4">Gunakan email & app password untuk mengirim invoice via SMTP.</div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Email Aplikasi (SMTP)</label>
            <input
              className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2"
              placeholder="mis. yourname@gmail.com"
              value={settings.smtpEmail || ""}
              onChange={(e) => setSettings({ ...settings, smtpEmail: e.target.value })}
            />
            <div className="text-xs text-black/50 mt-1">Disarankan Gmail dengan App Password.</div>
          </div>
          <div>
            <label className="text-sm">Password Aplikasi (App Password)</label>
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2"
              placeholder="16 karakter app password"
              value={settings.smtpAppPassword || ""}
              onChange={(e) => setSettings({ ...settings, smtpAppPassword: e.target.value })}
            />
            <div className="text-xs text-black/50 mt-1">Jangan gunakan password akun; gunakan App Password SMTP.</div>
          </div>
        </div>
      </SoftCard>

      {/* Pengaturan Regional */}
      <SoftCard className="p-6">
        <div className="font-semibold mb-1">Pengaturan Regional</div>
        <div className="text-xs text-black/60 mb-4">Bahasa dan mata uang</div>
        <div className="grid gap-3">
          <div>
            <label className="text-sm">Mata Uang</label>
            <select className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2" value={settings.currency || "IDR"} onChange={(e) => setSettings({ ...settings, currency: e.target.value })}>
              <option value="IDR">IDR - Rupiah Indonesia</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="MYR">MYR - Ringgit Malaysia</option>
            </select>
          </div>
          <div>
            <label className="text-sm">Bahasa</label>
            <select className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2" value={settings.language || "id-ID"} onChange={(e) => setSettings({ ...settings, language: e.target.value })}>
              <option value="id-ID">Bahasa Indonesia</option>
              <option value="en-US">English (US)</option>
            </select>
          </div>
          <div>
            <label className="text-sm">Tema Pastel</label>
            <select className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2" value={settings.themeKey || "pastel1"} onChange={(e) => setSettings({ ...settings, themeKey: e.target.value })}>
              <option value="pastel1">Pink muda → Biru muda</option>
              <option value="pastel2">Lavender → Mint</option>
              <option value="pastel3">Hangat → Lilac</option>
            </select>
          </div>
        </div>
      </SoftCard>

        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="rounded-2xl pastel-gradient-alt text-black/80 px-4 py-2 border border-black/10 hover:opacity-90 disabled:opacity-60 flex items-center gap-2" aria-busy={saving} aria-live="polite">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{saving ? "Menyimpan…" : "Simpan Pengaturan"}</span>
          </button>
        </div>
      </div>
    </>
  );
}
