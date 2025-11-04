import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import nodemailer from "nodemailer";
// Note: gunakan impor dinamis untuk puppeteer-core agar tidak dibundel di sisi klien
import fs from "fs";
import path from "path";
export const runtime = "nodejs";
import { getBrowser } from "@/lib/puppeteerShared";

// Reuse pooled SMTP transporters per credential to avoid repeated handshakes across requests
const SMTP_POOL = new Map<string, any>();
const COMMON_TIMEOUTS = { connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 } as const;
function getPooledTransporter(host: string, port: number, secure: boolean, email: string, appPassword: string) {
  const key = `${host}:${port}|${email}`;
  let t = SMTP_POOL.get(key);
  if (!t) {
    t = nodemailer.createTransport({ host, port, secure, auth: { user: email, pass: appPassword }, pool: true, maxConnections: 2, maxMessages: 20, ...COMMON_TIMEOUTS });
    SMTP_POOL.set(key, t);
  }
  return t;
}

async function getSessionUserId(req: Request | NextRequest): Promise<string | null> {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  const token = m ? decodeURIComponent(m[1]) : null;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || (session.expiresAt && session.expiresAt < new Date())) return null;
  return session.user.id;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await context.params;
  try {
    const body = await req.json().catch(() => ({}));
    const overrideEmail: string | undefined = body?.toEmail;
    // Abaikan flag simplePdf dan selalu coba kirim invoice penuh

    // Ambil invoice lengkap dan related customer, dukung short id jika perlu
    let inv = await prisma.invoice.findUnique({ where: { id }, include: { items: true, customer: true } });
    if (!inv || inv.userId !== userId) {
      const m = id.match(/^(\d{8})-(\d+)$/);
      if (m) {
        inv = await prisma.invoice.findFirst({ where: { userId, id: { endsWith: `-${m[1]}-${m[2]}` } }, include: { items: true, customer: true } });
      }
    }
    if (!inv || inv.userId !== userId) return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });

    // Ambil pengaturan termasuk kredensial SMTP
    const settings = await prisma.settings.findUnique({ where: { userId } });
    const smtpEmail = settings?.smtpEmail?.trim() || "";
    const smtpAppPassword = settings?.smtpAppPassword?.trim() || "";
    if (!smtpEmail || !smtpAppPassword) {
      return NextResponse.json({ error: "Pengaturan email belum lengkap (Email & App Password)" }, { status: 400 });
    }

    // Tentukan penerima: pakai override dari form jika ada, selain itu pakai email pelanggan
    const toEmail = (overrideEmail || inv.customer?.email || "").trim();
    if (!toEmail) {
      return NextResponse.json({ error: "Email pelanggan tidak tersedia" }, { status: 400 });
    }

    // Komposisi subject dan body email
    const companyName = settings?.companyName || "YB Invoice Maker";
    const currency = settings?.currency || "IDR";
    const nf = new Intl.NumberFormat(settings?.language || "id-ID", { style: "currency", currency, maximumFractionDigits: 0 });
    const dueText = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString(settings?.language || "id-ID") : "-";

    const itemsRows = inv.items.map(it => {
      const base = (it.unitPrice || 0) * (it.quantity || 0);
      const tax = it.taxRate ? Math.round(base * (it.taxRate / 100)) : 0;
      const amount = base + tax;
      return `
        <tr>
          <td style="padding:8px;border:1px solid #ddd">${it.description}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${it.quantity}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right">${nf.format(it.unitPrice || 0)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${it.taxRate ?? 0}%</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right">${nf.format(amount)}</td>
        </tr>`;
    }).join("");

    const totalStr = nf.format(inv.total || 0);
    const bankInfo = (() => {
      try {
        const accounts = (settings?.bankAccounts as any[]) || [];
        if (!accounts || accounts.length === 0) return "";
        const acc = accounts[0];
        return `<p><b>Rekening Utama</b>: ${acc.bankName || settings?.bankName || ""} — ${acc.accountNumber || settings?.bankAccount || ""}</p>`;
      } catch { return ""; }
    })();

    const ownerBlock = (() => {
      const owner = settings?.ownerName || "";
      const title = settings?.ownerTitle || "";
      if (!owner && !title) return "";
      return `<p>Hormat kami,<br><b>${owner}</b>${title ? `<br>${title}` : ""}</p>`;
    })();

    // Display ID menggunakan prefix dari pengaturan agar dapat menampilkan karakter "/" secara aman
    const prefixDisplay = (settings?.invoicePrefix || "INV").trim();
    const mId = inv.id.match(/^(.+)-(\d{8})-(\d+)$/);
    const dateKey = mId?.[2] || "";
    const seqStr = mId?.[3] || "";
    const displayId = dateKey && seqStr ? `${prefixDisplay}-${dateKey}-${seqStr}` : `${prefixDisplay}-${inv.id}`;
    const subject = `Invoice ${displayId} dari ${companyName}`;
    const html = `
      <div style="font-family:Arial,sans-serif;">
        <p>Halo ${inv.clientName},</p>
        <p>Berikut kami kirimkan invoice Anda:</p>
        <table style="border-collapse:collapse;margin-top:8px;margin-bottom:12px">
          <tr><td><b>No. Invoice</b></td><td style="padding-left:8px">${displayId}</td></tr>
          <tr><td><b>Tanggal</b></td><td style="padding-left:8px">${new Date(inv.date).toLocaleDateString(settings?.language || "id-ID")}</td></tr>
          <tr><td><b>Jatuh Tempo</b></td><td style="padding-left:8px">${dueText}</td></tr>
          <tr><td><b>Status</b></td><td style="padding-left:8px">${inv.status}</td></tr>
        </table>
        <table style="border-collapse:collapse;width:100%">
          <thead>
            <tr>
              <th style="padding:8px;border:1px solid #ddd;text-align:left">Item</th>
              <th style="padding:8px;border:1px solid #ddd">Qty</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:right">Harga</th>
              <th style="padding:8px;border:1px solid #ddd">Pajak</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
        <p style="text-align:right"><b>Total</b>: ${totalStr}</p>
        ${bankInfo}
        ${inv.note ? `<p><b>Catatan:</b> ${inv.note}</p>` : ""}
        ${ownerBlock}
        <hr>
        <small>Email ini dikirim otomatis oleh sistem ${companyName}.</small>
      </div>
    `;

    // Generate PDF attachment by rendering the print page with Puppeteer
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
        "C\\\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C\\\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C\\\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C\\\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      ].filter(Boolean) as string[];
      for (const p of candidates) {
        try { if (p && fs.existsSync(p)) return p; } catch {}
      }
      return null;
    }

    async function launchPuppeteerBrowser() {
      // Prioritaskan puppeteer-core dengan browser lokal bila tersedia
      try {
        const m2 = await import("puppeteer-core");
        const puppeteerCore = (m2 as any).default || m2;
        const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || await findChromeExecutablePath();
        if (executablePath) {
          console.info("Meluncurkan puppeteer-core dengan executable:", executablePath);
          return puppeteerCore.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
        }
      } catch {}
      // Jika browser lokal tidak ditemukan, jatuhkan ke paket puppeteer penuh
      try {
        const m = await import("puppeteer");
        const puppeteer = (m as any).default || m;
        try {
          return await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
        } catch (e: any) {
          console.warn("Puppeteer default Chromium gagal diluncurkan:", e?.message || e);
          try {
            return await puppeteer.launch({ channel: "chrome", headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
          } catch (e2: any) {
            console.warn("Puppeteer channel=chrome gagal:", e2?.message || e2);
            try {
              return await puppeteer.launch({ channel: "msedge", headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
            } catch (e3: any) {
              console.warn("Puppeteer channel=msedge gagal:", e3?.message || e3);
            }
          }
        }
      } catch {}
      throw new Error("Chrome/Edge tidak ditemukan. Set PUPPETEER_EXECUTABLE_PATH ke path browser Anda.");
    }

    async function generateInvoicePdfWithPuppeteer() {
      const tPdfStart = Date.now();
      const browser = await getBrowser();
      const page = await browser.newPage();
      try {
        // Reuse user's session cookie for auth
        const cookieHeader = req.headers.get("cookie");
        const m = cookieHeader?.match(/(?:^|;\s*)session=([^;]+)/);
        const token = m ? decodeURIComponent(m[1]) : null;
        const origin = (req as any)?.nextUrl?.origin || "http://localhost:3000";
        if (token) {
          await page.setCookie({ name: "session", value: token, url: origin });
        }
        const url = `${origin}/invoices/${id}/print?pdf=0&server=1`;
        console.info("PDF: membuka", url);
        const tNavStart = Date.now();
        await page.goto(url, { waitUntil: "domcontentloaded" });
        console.info("Timing: page.goto ms", Date.now() - tNavStart);
        await page.emulateMediaType("print");
        // Tunggu halaman benar-benar memuat data invoice: marker siap atau respons API /api/invoices/{id}
        const tDataWaitStart = Date.now();
        await Promise.race([
          page.waitForSelector("#print-ready[data-ok='1']", { timeout: 15000 }),
          page.waitForResponse((res: any) => {
            try {
              const u = new URL(res.url());
              return u.pathname === `/api/invoices/${id}` && res.status() === 200;
            } catch { return false; }
          }, { timeout: 12000 })
        ]).catch(async () => {
          // fallback: tunggu kertas A4 muncul
          await page.waitForSelector("div.w-\\[210mm\\]", { timeout: 5000 }).catch(() => {});
        });
        console.info("Timing: data ready wait ms", Date.now() - tDataWaitStart);
        // Pastikan konten invoice sudah ter-render: ada baris item minimal 1
        await page.waitForFunction(() => {
          const table = document.querySelector("table");
          if (!table) return false;
          const rows = table.querySelectorAll("tbody tr");
          return rows.length > 0;
        }, { timeout: 8000 }).catch(() => {});
        // Tunggu logo bila ada agar image benar-benar loaded, tanpa tidur yang tidak perlu
        try {
          const hasLogo = await page.evaluate(() => !!document.querySelector(".h-16 img"));
          if (hasLogo) {
            const tLogoWaitStart = Date.now();
            await page.waitForFunction(() => {
              const img = document.querySelector(".h-16 img") as HTMLImageElement | null;
              if (!img) return true; // no logo
              return img.complete && img.naturalWidth > 0;
            }, { timeout: 1500 }).catch(() => {});
            console.info("Timing: logo load wait ms", Date.now() - tLogoWaitStart);
          }
        } catch {}
        let pdfBuffer: Buffer;
        try {
          const raw = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" } });
          pdfBuffer = Buffer.isBuffer(raw) ? (raw as Buffer) : Buffer.from(raw as Uint8Array);
        } catch (err: any) {
          console.error("PDF: page.pdf error:", err?.message || err);
          throw err;
        }
        console.info("PDF: buffer size", pdfBuffer.length || 0);
        console.info("Timing: PDF total ms", Date.now() - tPdfStart);
        return pdfBuffer;
      } finally {
        try { await page.close(); } catch {}
      }
    }

    // Fallback sederhana: render HTML ringkas langsung menjadi PDF bila halaman print gagal
    async function generateSimpleInvoicePdf(): Promise<Buffer> {
      const browser = await getBrowser();
      const page = await browser.newPage();
      try {
        const simpleHtml = `<!doctype html>
          <html>
            <head>
              <meta charset="utf-8" />
              <style>
                @page { size: A4; margin: 0 }
                body { font-family: Arial, sans-serif; margin: 24px }
                h1 { font-size: 18px; margin: 0 0 8px }
                table { border-collapse: collapse; width: 100%; font-size: 12px }
                th, td { border: 1px solid #ddd; padding: 6px }
                .right { text-align: right }
                .mt { margin-top: 12px }
              </style>
            </head>
            <body>
              <h1>Invoice ${inv!.id}</h1>
              <div>Perusahaan: ${companyName}</div>
              <div>Pelanggan: ${inv!.clientName}</div>
              <div>Tanggal: ${new Date(inv!.date).toLocaleDateString(settings?.language || "id-ID")}</div>
              <div>Jatuh Tempo: ${dueText}</div>
              <table class="mt">
                <thead>
                  <tr>
                    <th>Deskripsi</th>
                    <th class="right">Qty</th>
                    <th class="right">Harga</th>
                    <th class="right">Pajak</th>
                    <th class="right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
              </table>
              <div class="right mt"><b>Total</b>: ${totalStr}</div>
            </body>
          </html>`;
        await page.setContent(simpleHtml, { waitUntil: "networkidle0" });
        await page.emulateMediaType("print");
        const raw = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" } });
        const pdfBuffer = Buffer.isBuffer(raw) ? (raw as Buffer) : Buffer.from(raw as Uint8Array);
        console.info("PDF(fallback): buffer size", pdfBuffer.length || 0);
        return pdfBuffer;
      } finally {
        try { await page.close(); } catch {}
      }
    }

    // Timeout umum untuk koneksi SMTP agar tidak menggantung
    // Kirim email dengan fallback: 465 lalu 587, kedua-duanya dibatasi timeout
    function sendMailWithTimeout(transporter: any, mailOptions: any, ms: number) {
      return Promise.race([
        transporter.sendMail(mailOptions),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout saat mengirim email. Cek koneksi SMTP/App Password.")), ms)),
      ]);
    }

    async function sendMailWithFallback(mailOptions: any) {
      // 465 SSL (gunakan pooled transporter untuk mengurangi handshakes berulang)
      let transporter = getPooledTransporter("smtp.gmail.com", 465, true, smtpEmail, smtpAppPassword);
      try {
        await sendMailWithTimeout(transporter, mailOptions, 20000);
        return;
      } catch {
        // 587 STARTTLS
        transporter = getPooledTransporter("smtp.gmail.com", 587, false, smtpEmail, smtpAppPassword);
        await sendMailWithTimeout(transporter, mailOptions, 20000);
      }
    }

    try {
      const origin = (req as any)?.nextUrl?.origin || "http://localhost:3000";
      let pdfBuffer: Buffer | null = null;
      const tAllStart = Date.now();
      try {
        // Selalu coba buat PDF invoice lengkap
        pdfBuffer = await generateInvoicePdfWithPuppeteer();
      } catch (e1: any) {
        console.error("Gagal membuat PDF invoice via Puppeteer (halaman print):", e1?.message || e1);
        // Coba fallback sederhana agar tetap ada lampiran PDF
        try {
          pdfBuffer = await generateSimpleInvoicePdf();
        } catch (e2: any) {
          console.error("Gagal membuat PDF invoice fallback sederhana:", e2?.message || e2);
          pdfBuffer = null;
        }
      }
      const printLink = `${origin}/invoices/${id}/print?pdf=1`;
      const htmlWithLink = `${html}<p>Jika lampiran PDF tidak terlihat, unduh invoice melalui tautan: <a href="${printLink}">${printLink}</a></p>`;

      const mailOptions: any = {
        from: `${companyName} <${smtpEmail}>`,
        to: toEmail,
        subject,
        html: htmlWithLink,
      };
      if (pdfBuffer) {
        const safeIdForFilename = (inv!.id || "").replace(/[\\/]/g, "-");
        (mailOptions as any).attachments = [
          {
            filename: `Invoice-${safeIdForFilename}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ];
      }
      const tSendStart = Date.now();
      await sendMailWithFallback(mailOptions);
      console.info("Timing: SMTP send ms", Date.now() - tSendStart);
      console.info("Timing: send-email total ms", Date.now() - tAllStart);
    } catch (err: any) {
      const msg = typeof err?.message === "string" ? err.message : "Gagal mengirim email";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: `Email berhasil dikirim ke ${toEmail}` });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Gagal mengirim email";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}