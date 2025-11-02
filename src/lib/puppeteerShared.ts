import fs from "fs";
import path from "path";

type Browser = any;

async function findChromeExecutablePath() {
  const pf = process.env["ProgramFiles"] || "C:/Program Files";
  const pfx86 = process.env["ProgramFiles(x86)"] || "C:/Program Files (x86)";
  const la = process.env.LOCALAPPDATA || "";
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    `${pf}/Google/Chrome/Application/chrome.exe`,
    `${pfx86}/Google/Chrome/Application/chrome.exe`,
    `${pf}/Microsoft/Edge/Application/msedge.exe`,
    `${pfx86}/Microsoft/Edge/Application/msedge.exe`,
    `${pf}/BraveSoftware/Brave-Browser/Application/brave.exe`,
    `${pfx86}/BraveSoftware/Brave-Browser/Application/brave.exe`,
    path.join(la, "Google/Chrome/Application/chrome.exe"),
    path.join(la, "Microsoft/Edge/Application/msedge.exe"),
    path.join(la, "BraveSoftware/Brave-Browser/Application/brave.exe"),
    // Backslash variants (just in case)
    "C\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

const g = globalThis as any;

export async function getBrowser(): Promise<Browser> {
  if (g.__PUP_BROWSER_PROMISE__) return g.__PUP_BROWSER_PROMISE__;
  g.__PUP_BROWSER_PROMISE__ = (async () => {
    // Prioritaskan puppeteer-core dengan executable lokal bila tersedia
    try {
      const m2 = await import("puppeteer-core");
      const puppeteerCore = (m2 as any).default || m2;
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || await findChromeExecutablePath();
      if (executablePath) {
        console.info("[PuppeteerShared] Launch puppeteer-core:", executablePath);
        return await puppeteerCore.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
      }
    } catch {}
    // Jika gagal, fallback ke paket puppeteer penuh
    try {
      const m = await import("puppeteer");
      const puppeteer = (m as any).default || m;
      try {
        return await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
      } catch (e: any) {
        console.warn("[PuppeteerShared] default Chromium failed:", e?.message || e);
        try {
          return await puppeteer.launch({ channel: "chrome", headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
        } catch (e2: any) {
          console.warn("[PuppeteerShared] channel=chrome failed:", e2?.message || e2);
          try {
            return await puppeteer.launch({ channel: "msedge", headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
          } catch (e3: any) {
            console.warn("[PuppeteerShared] channel=msedge failed:", e3?.message || e3);
          }
        }
      }
    } catch {}
    throw new Error("Chrome/Edge tidak ditemukan. Set PUPPETEER_EXECUTABLE_PATH ke path browser Anda.");
  })();

  // Tutup browser saat proses akan keluar
  try {
    process.on("beforeExit", () => {
      const p: Promise<Browser> = g.__PUP_BROWSER_PROMISE__;
      if (p) p.then((b: Browser) => b.close()).catch(() => {});
    });
  } catch {}

  return g.__PUP_BROWSER_PROMISE__;
}

export async function withPage<T>(fn: (page: any) => Promise<T>): Promise<T> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try { return await fn(page); } finally { try { await page.close(); } catch {} }
}