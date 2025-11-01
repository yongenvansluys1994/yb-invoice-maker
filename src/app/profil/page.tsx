"use client";
import { useEffect, useMemo, useState } from "react";
import SoftCard from "@/components/SoftCard";
import { getSettings } from "@/lib/settings";
import { getProfile, saveProfile } from "@/lib/profile";

export default function ProfilPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Informasi perusahaan & rekening kini dikelola di modul Pengaturan

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      let meEmail = "";
      let meName = "";
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const me = await res.json();
          meEmail = me?.email || "";
          meName = me?.name || "";
        }
      } catch {}
      const p = getProfile();
      setFullName(p.fullName || meName);
      setEmail(p.email || meEmail);
      setPhone(p.phone);
    })();
  }, []);

  const initials = useMemo(() => {
    const parts = fullName.trim().split(/\s+/);
    return (parts[0]?.[0] || "A") + (parts[1]?.[0] || "U");
  }, [fullName]);

  async function onSave() {
    setSaving(true);
    setSaved(false);
    // save profile
    saveProfile({ fullName, email, phone });
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      // reload to propagate settings to AppShell/Header
      if (typeof window !== "undefined") window.location.reload();
    }, 600);
  }

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Profil</h2>
        <p className="text-sm text-black/60">Kelola informasi profil Anda</p>
      </div>

      {/* Header card */}
      <SoftCard className="p-6 flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-violet-200 text-violet-700 flex items-center justify-center font-semibold">
          {initials}
        </div>
        <div className="flex-1">
          <div className="font-semibold">{fullName || "Admin User"}</div>
          <div className="text-sm text-black/60">{email || "—"}</div>
          <div className="text-sm text-black/60">{getSettings().companyName || "YB Teknologi"}</div>
        </div>
      </SoftCard>

      {/* Informasi Personal */}
      <SoftCard className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-6 rounded-lg bg-black/10 flex items-center justify-center">👤</div>
          <h3 className="font-semibold">Informasi Personal</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Nama Lengkap *</label>
            <input value={fullName} onChange={e=>setFullName(e.target.value)} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm bg-white/80" placeholder="Admin User" />
          </div>
          <div>
            <label className="text-sm font-medium">Email *</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm bg-white/80" placeholder="email@domain.com" />
          </div>
        </div>
        <div className="mt-4">
          <label className="text-sm font-medium">Nomor Telepon</label>
          <input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm bg-white/80" placeholder="62 812-3456-7890" />
        </div>
      </SoftCard>

      {/* Informasi Perusahaan & Rekening telah dipindahkan ke modul Pengaturan */}

      <div className="flex items-center justify-end gap-3">
        {saved ? <span className="text-sm text-green-700">Tersimpan</span> : null}
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-violet-600 text-white px-4 py-2 text-sm hover:bg-violet-700 disabled:opacity-60"
        >
          {saving ? "Menyimpan..." : "Simpan Profil"}
        </button>
      </div>
    </div>
  );
}