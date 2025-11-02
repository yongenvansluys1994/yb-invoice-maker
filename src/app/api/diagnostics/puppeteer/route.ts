import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

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
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

export async function GET() {
  let method: "puppeteer" | "puppeteer-channel" | "puppeteer-core" | null = null;
  let channel: "chrome" | "msedge" | undefined;
  let executablePath: string | null = null;
  try {
    // 1) Coba puppeteer dengan Chromium bawaan
    try {
      const m = await import("puppeteer");
      const puppeteer = (m as any).default || m;
      try {
        const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
        const page = await browser.newPage();
        await page.setContent("<!doctype html><html><head><style>@page{size:A4;margin:0}</style></head><body><div>OK</div></body></html>");
        await page.emulateMediaType("print");
        const buffer = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" } });
        await browser.close();
        method = "puppeteer";
        return NextResponse.json({ ok: true, method, pdfSize: (buffer as any)?.length || 0 });
      } catch {}
      // 2) Coba puppeteer channel chrome/msedge
      try {
        const browser = await puppeteer.launch({ channel: "chrome", headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
        const page = await browser.newPage();
        await page.setContent("<!doctype html><html><head><style>@page{size:A4;margin:0}</style></head><body><div>OK</div></body></html>");
        await page.emulateMediaType("print");
        const buffer = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" } });
        await browser.close();
        method = "puppeteer-channel";
        channel = "chrome";
        return NextResponse.json({ ok: true, method, channel, pdfSize: (buffer as any)?.length || 0 });
      } catch {}
      try {
        const browser = await puppeteer.launch({ channel: "msedge", headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
        const page = await browser.newPage();
        await page.setContent("<!doctype html><html><head><style>@page{size:A4;margin:0}</style></head><body><div>OK</div></body></html>");
        await page.emulateMediaType("print");
        const buffer = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" } });
        await browser.close();
        method = "puppeteer-channel";
        channel = "msedge";
        return NextResponse.json({ ok: true, method, channel, pdfSize: (buffer as any)?.length || 0 });
      } catch {}
    } catch {}

    // 3) puppeteer-core dengan path executable lokal
    const m2 = await import("puppeteer-core");
    const puppeteerCore = (m2 as any).default || m2;
    executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || await findChromeExecutablePath();
    if (!executablePath) {
      return NextResponse.json({ ok: false, error: "Chrome/Edge tidak ditemukan. Set PUPPETEER_EXECUTABLE_PATH." }, { status: 500 });
    }
    const browser = await puppeteerCore.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><head><style>@page{size:A4;margin:0}</style></head><body><div>OK</div></body></html>");
    await page.emulateMediaType("print");
    const buffer = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" } });
    await browser.close();
    method = "puppeteer-core";
    return NextResponse.json({ ok: true, method, executablePath, pdfSize: (buffer as any)?.length || 0 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Gagal menjalankan Puppeteer";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}