export type AppSettings = {
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
  currency?: string; // e.g., IDR, USD
  language?: string; // e.g., id-ID, en-US
  themeKey?: string;
  npwp?: string;
  address?: string;
  smtpEmail?: string;
  smtpAppPassword?: string;
};

function currentUid(): string {
  try {
    const uid = sessionStorage.getItem("invgenz:uid");
    return uid && uid.trim() ? uid : "global";
  } catch {
    return "global";
  }
}

const defaults: Required<AppSettings> = {
  companyName: "Bagus Asri Mandiri",
  logoUrl: "",
  bankName: "",
  bankAccount: "",
  bankAccounts: [],
  ownerName: "",
  ownerTitle: "",
  invoicePrefix: "INV",
  defaultTaxRate: 11,
  defaultPphRate: 1.5,
  currency: "IDR",
  language: "id-ID",
  themeKey: "pastel1",
  npwp: "",
  address: "Jakarta, Indonesia",
  smtpEmail: "",
  smtpAppPassword: "",
};

export function getSettings(): Required<AppSettings> {
  try {
    // Prioritize server-fetched cache
    const uid = currentUid();
    const serverRaw = sessionStorage.getItem(`invgenz:${uid}:settings:server`);
    if (serverRaw) {
      const s = JSON.parse(serverRaw) as AppSettings;
      const merged = { ...defaults, ...s } as Required<AppSettings>;
      // Overlay dari localStorage hanya untuk field yang diizinkan
      try {
        const localRaw = localStorage.getItem(`invgenz:${uid}:settings`) || "{}";
        const local = JSON.parse(localRaw) as AppSettings;
        // Logo selalu dari lokal (jika ada)
        if (!merged.logoUrl && local.logoUrl) merged.logoUrl = local.logoUrl as any;
        // Field regional dan format selalu mengikuti lokal jika tersedia
      if (local.currency) merged.currency = local.currency as any;
      if (local.language) merged.language = local.language as any;
      if (local.themeKey) merged.themeKey = local.themeKey as any;
      if (local.invoicePrefix) merged.invoicePrefix = local.invoicePrefix as any;
      if (typeof local.defaultTaxRate === "number") merged.defaultTaxRate = local.defaultTaxRate as any;
      if (typeof local.defaultPphRate === "number") merged.defaultPphRate = local.defaultPphRate as any;
      } catch {}
      // Fallback: jika nilai dari server kosong, pakai defaults
      if (!merged.currency || String(merged.currency).trim() === "") merged.currency = defaults.currency;
      if (!merged.language || String(merged.language).trim() === "") merged.language = defaults.language;
      if (!merged.themeKey || String(merged.themeKey).trim() === "") merged.themeKey = defaults.themeKey;
      if (!merged.invoicePrefix || String(merged.invoicePrefix).trim() === "") merged.invoicePrefix = defaults.invoicePrefix;
      if (typeof merged.defaultTaxRate !== "number") merged.defaultTaxRate = defaults.defaultTaxRate;
      if (typeof merged.defaultPphRate !== "number") merged.defaultPphRate = defaults.defaultPphRate;
      // Backward compatibility for single bank fields
      if ((merged.bankAccounts?.length || 0) > 0) {
        merged.bankName = merged.bankAccounts![0].bankName;
        merged.bankAccount = merged.bankAccounts![0].accountNumber;
      } else if (merged.bankName && merged.bankAccount) {
        merged.bankAccounts = [
          { bankName: merged.bankName, accountNumber: merged.bankAccount, alias: "Utama" },
        ];
      }
      return merged;
    }
  } catch {}
  try {
    const uid = currentUid();
    const raw = localStorage.getItem(`invgenz:${uid}:settings`) || "{}";
    const s = JSON.parse(raw) as AppSettings;
    // Hanya ambil field yang diizinkan dari lokal ketika server belum tersedia
    const allowedFromLocal: Partial<AppSettings> = {
      logoUrl: s.logoUrl,
      currency: s.currency,
      language: s.language,
      themeKey: s.themeKey,
      invoicePrefix: s.invoicePrefix,
      defaultTaxRate: s.defaultTaxRate,
      defaultPphRate: s.defaultPphRate,
    };
    const merged = { ...defaults, ...allowedFromLocal } as Required<AppSettings>;
    if ((merged.bankAccounts?.length || 0) > 0) {
      merged.bankName = merged.bankAccounts![0].bankName;
      merged.bankAccount = merged.bankAccounts![0].accountNumber;
    } else if (merged.bankName && merged.bankAccount) {
      merged.bankAccounts = [
        { bankName: merged.bankName, accountNumber: merged.bankAccount, alias: "Utama" },
      ];
    }
    return merged;
  } catch {
    return defaults;
  }
}

export async function fetchSettings(): Promise<Required<AppSettings>> {
  try {
    const res = await fetch("/api/settings", { cache: "no-store" });
    const data = await res.json();
    const merged = { ...defaults, ...(data || {}) } as Required<AppSettings>;
    try {
      const uid = currentUid();
      sessionStorage.setItem(`invgenz:${uid}:settings:server`, JSON.stringify(merged));
    } catch {}
    return merged;
  } catch {
    return getSettings();
  }
}

export function formatCurrency(amount: number): string {
  const s = getSettings();
  const language = (typeof s.language === "string" && s.language.trim()) || "id-ID";
  const currency = (typeof s.currency === "string" && s.currency.trim()) || "IDR";
  const nf = new Intl.NumberFormat(language, { style: "currency", currency, maximumFractionDigits: 0 });
  return nf.format(Math.round(amount || 0));
}

export function formatDate(iso: string): string {
  const s = getSettings();
  try { return new Date(iso).toLocaleDateString(s.language); } catch { return iso; }
}

export function generateInvoiceId(dateISO?: string): string {
  const s = getSettings();
  const dateKey = (dateISO || new Date().toISOString().slice(0, 10)).replaceAll("-", "");
  const uid = currentUid();
  const seqMapStr = localStorage.getItem(`invgenz:${uid}:invoiceSeq`) || "{}";
  let seqMap: Record<string, number> = {};
  try { seqMap = JSON.parse(seqMapStr); } catch { seqMap = {}; }
  const next = (seqMap[dateKey] || 0) + 1;
  seqMap[dateKey] = next;
  localStorage.setItem(`invgenz:${uid}:invoiceSeq`, JSON.stringify(seqMap));
  const seqStr = String(next).padStart(3, "0");
  return `${s.invoicePrefix}-${dateKey}-${seqStr}`;
}