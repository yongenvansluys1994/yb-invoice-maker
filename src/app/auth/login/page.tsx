"use client";
import { useEffect, useState } from "react";
import SoftCard from "@/components/SoftCard";
import Link from "next/link";
import { fetchSettings } from "@/lib/settings";
import { Mail, Lock, Facebook, Apple } from "lucide-react";
import Image from "next/image";
import LoginBg from "@/components/Untitled.png";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<{ name: string; logoUrl?: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchSettings();
        setCompany({ name: s.companyName, logoUrl: s.logoUrl });
      } catch {}
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          window.location.href = "/dashboard";
        }
      } catch {}
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal login");
      } else {
        // Simpan uid ke sessionStorage sebelum redirect agar namespace lokal siap
        try {
          const meRes = await fetch("/api/auth/me", { cache: "no-store" });
          if (meRes.ok) {
            const me = await meRes.json();
            sessionStorage.setItem("invgenz:uid", String(me.id));
          }
        } catch {}
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
  {/* Left Login Form */}
  <div className="flex items-center justify-center p-10 bg-white relative">
    <div className="absolute top-10 flex flex-col items-center w-full">
      {company?.logoUrl ? (
        <img
          src={company.logoUrl}
          className="h-14 w-14 rounded-lg object-cover mb-2"
        />
      ) : (
        <div className="h-14 w-14 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center text-2xl mb-2">
          💼
        </div>
      )}
      <span className="text-xl font-semibold text-black/80">
        YB Invoice Maker
      </span>
    </div>

    <SoftCard className="p-12 w-full max-w-xl shadow-lg border border-black/10 rounded-2xl mt-28">
      <h1 className="text-3xl font-semibold mb-1 text-center">
        Hai, selamat datang kembali
      </h1>
      <p className="text-base text-black/60 mb-6 text-center">
        Baru di aplikasi ini?{" "}
        <Link
          href="/auth/register"
          className="text-violet-700 hover:underline font-medium"
        >
          Daftar Gratis
        </Link>
      </p>

      <form className="space-y-5" onSubmit={onSubmit}>
        <div>
          <label className="text-base font-medium">Email</label>
          <div className="mt-2 relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-black/50" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-11 w-full rounded-lg border border-black/10 px-4 py-4 text-base bg-white/80"
              placeholder="contoh: email@domain.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-base font-medium">Kata sandi</label>
          <div className="mt-2 relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-black/50" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-11 w-full rounded-lg border border-black/10 px-4 py-4 text-base bg-white/80"
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 select-none">
            <input type="checkbox" className="rounded" />
            <span className="text-base">Ingat perangkat ini</span>
          </label>
          <Link href="#" className="text-violet-700 hover:underline text-base">
            Lupa kata sandi?
          </Link>
        </div>

        {error ? (
          <div className="text-base text-red-600">{error}</div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-violet-600 text-white px-4 py-4 text-base font-medium hover:bg-violet-700 disabled:opacity-60 transition"
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>

       

      <div className="mt-6 text-sm text-black/60 text-center">
        Dengan melanjutkan, kamu menyetujui{" "}
        <Link href="#" className="hover:underline font-medium">
          Syarat Penggunaan
        </Link>{" "}
        dan{" "}
        <Link href="#" className="hover:underline font-medium">
          Kebijakan Privasi
        </Link>{" "}
        kami.
      </div>
    </SoftCard>
  </div>

  {/* Right Illustration / Tagline */}
  <div className="hidden md:flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 relative">
    <Image
      src={LoginBg}
      alt="Background"
      fill
      className="object-cover mix-blend-overlay opacity-40"
    />
    <div className="relative z-10 text-center text-white flex flex-col items-center">
      {company?.logoUrl ? (
        <img
          src={company.logoUrl}
          className="h-20 w-20 rounded-xl object-cover mb-3"
        />
      ) : (
        <div className="h-20 w-20 rounded-xl bg-white/20 flex items-center justify-center text-3xl mb-3">
          💼
        </div>
      )}
      <h2 className="text-3xl font-semibold mb-8 tracking-wide">
        YB Invoice Maker
      </h2>
      <div className="max-w-3xl px-16">
        <h2 className="text-xl font-medium mb-4 leading-snug tracking-wide">
          Buat Invoice Lebih Mudah.
          <br />
          Kelola Bisnis Lebih Cepat.
        </h2>
        <p className="text-white/90 text-base leading-relaxed">
          Hasilkan invoice profesional dalam hitungan detik dengan{" "}
          <span className="font-semibold">YB Invoice Maker</span>. Sederhana,
          efisien, dan aman untuk bisnis modern Anda.
        </p>
      </div>
    </div>
  </div>
</div>


  );
}