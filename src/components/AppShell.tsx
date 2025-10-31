"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LayoutDashboard, FileText, Settings, Users, Package, CreditCard, BarChart3, User as UserIcon, LogOut } from "lucide-react";
import clsx from "clsx";
import { fetchSettings, type AppSettings } from "@/lib/settings";
import logoYB from "@/components/logo.png";
import ToastProvider from "@/components/Toast";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();
  // Avoid reading localStorage/sessionStorage during SSR hydration.
  // Defer settings load to client effect to prevent HTML mismatch.
  const [s, setS] = useState<Required<AppSettings> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const me = await res.json();
          try { sessionStorage.setItem("invgenz:uid", String(me.id)); } catch {}
        }
      } catch {}
      const data = await fetchSettings();
      setS(data);
    })();
  }, []);

  async function onLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/auth/login";
  }

  // Tampilkan halaman auth tanpa sidebar/drawer
  if (pathname?.startsWith("/auth")) {
    return (
      <div className="min-h-screen w-full pastel-gradient">
        <div className="min-h-screen w-full bg-white/60 dark:bg-black/40 backdrop-blur-sm">
          <main className="min-h-screen">
            <section className="p-4">
              {children}
            </section>
          </main>
          <ToastProvider />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full pastel-gradient">
      <div className="min-h-screen w-full bg-white/60 dark:bg-black/40 backdrop-blur-sm">
        <aside
          className={clsx(
            "fixed left-0 top-0 z-40 h-full bg-white/80 dark:bg-white/10 backdrop-blur-sm border-r border-black/10 dark:border-white/10",
            "transition-all",
            open ? "w-64" : "w-16"
          )}
        >
          <div className="flex items-center justify-between p-4">
            <div className={clsx("flex items-center gap-2", !open && "justify-center w-full")}> 
              <img
                src={(s?.logoUrl && s.logoUrl.trim()) ? s.logoUrl : (logoYB as any).src}
                alt={s?.companyName || "Logo"}
                className="h-7 w-7 rounded-lg object-cover"
              />
              <span className={clsx("font-semibold text-sm", !open && "sr-only")}>{s?.companyName || "YB Invoice Maker"}</span>
            </div>
            <button
              className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => setOpen(!open)}
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <nav className="mt-2 space-y-1">
            <SidebarLink href="/dashboard" icon={<LayoutDashboard className="h-5 w-5" />} label="Dashboard" open={open} active={pathname?.startsWith("/dashboard") ?? false} />
            <SidebarLink href="/pelanggan" icon={<Users className="h-5 w-5" />} label="Pelanggan" open={open} active={pathname?.startsWith("/pelanggan") ?? false} />
            <SidebarLink href="/produk" icon={<Package className="h-5 w-5" />} label="Produk/Jasa" open={open} active={pathname?.startsWith("/produk") ?? false} />
            <SidebarLink href="/invoices" icon={<FileText className="h-5 w-5" />} label="Invoice" open={open} active={pathname?.startsWith("/invoices") ?? false} />
            <SidebarLink href="/pembayaran" icon={<CreditCard className="h-5 w-5" />} label="Pembayaran" open={open} active={pathname?.startsWith("/pembayaran") ?? false} />
            <SidebarLink href="/laporan" icon={<BarChart3 className="h-5 w-5" />} label="Laporan" open={open} active={pathname?.startsWith("/laporan") ?? false} />
            <SidebarLink href="/settings" icon={<Settings className="h-5 w-5" />} label="Pengaturan" open={open} active={pathname?.startsWith("/settings") ?? false} />
            <SidebarLink href="/profil" icon={<UserIcon className="h-5 w-5" />} label="Profil" open={open} active={pathname?.startsWith("/profil") ?? false} />
          </nav>

          <div className="absolute bottom-4 left-0 right-0 px-2">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-black/80 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl"
            >
              <LogOut className="h-5 w-5" />
              <span className={clsx(!open && "sr-only")}>Logout</span>
            </button>
          </div>
        </aside>

        <main className={clsx("min-h-screen transition-all", open ? "ml-64" : "ml-16")}> 
          {pathname?.startsWith("/dashboard") && (
            <div className="p-4">
              <div className="soft-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10 md:hidden"
                    onClick={() => setOpen(!open)}
                    aria-label="Toggle sidebar"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <div>
                    <div className="text-xs text-black/70 dark:text-white/70">{s?.companyName || "YB Invoice Maker"}</div>
                    <h1 className="text-lg font-semibold">Selamat datang kembali!</h1>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <img
                    src={(s?.logoUrl && s.logoUrl.trim()) ? s.logoUrl : (logoYB as any).src}
                    alt={s?.companyName || "Logo"}
                    className="h-7 w-7 rounded-lg object-cover"
                  />
                  <span className="text-sm text-black/60 dark:text-white/60">{s?.companyName || "YB Invoice Maker"}</span>
                </div>
              </div>
            </div>
          )}
          <section className="p-4">
            {children}
          </section>
        </main>
        {/* Global Toasts */}
        <ToastProvider />
      </div>
    </div>
  );
}

function SidebarLink({ href, icon, label, open, active }: { href: string; icon: React.ReactNode; label: string; open: boolean; active: boolean }) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 px-3 py-2 text-sm rounded-xl mx-2 transition-colors",
        active
          ? "bg-black/10 dark:bg-white/10 text-black dark:text-white"
          : "text-black/80 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/10"
      )}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span className={clsx(!open && "sr-only")}>{label}</span>
    </Link>
  );
}