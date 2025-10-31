import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import nodemailer from "nodemailer";
// Note: gunakan impor dinamis untuk puppeteer-core agar tidak dibundel di sisi klien
import fs from "fs";
import path from "path";
export const runtime = "nodejs";

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

    // Ambil invoice lengkap dan related customer
    const inv = await prisma.invoice.findUnique({ where: { id }, include: { items: true, customer: true } });
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

    const subject = `Invoice ${inv.id} dari ${companyName}`;
    const html = `
      <div style="font-family:Arial,sans-serif;">
        <p>Halo ${inv.clientName},</p>
        <p>Berikut kami kirimkan invoice Anda:</p>
        <table style="border-collapse:collapse;margin-top:8px;margin-bottom:12px">
          <tr><td><b>No. Invoice</b></td><td style="padding-left:8px">${inv.id}</td></tr>
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
      const candidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
        "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
        path.join(process.env.LOCALAPPDATA || "", "Microsoft/Edge/Application/msedge.exe"),
      ].filter(Boolean) as string[];
      for (const p of candidates) {
        try { if (p && fs.existsSync(p)) return p; } catch {}
      }
      return null;
    }

    async function generateInvoicePdfWithPuppeteer() {
      const { default: puppeteer } = await import("puppeteer-core");
      const executablePath = await findChromeExecutablePath();
      if (!executablePath) {
        throw new Error("Chrome/Edge tidak ditemukan. Set PUPPETEER_EXECUTABLE_PATH ke path browser Anda.");
      }
      const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
      try {
        const page = await browser.newPage();
        // Reuse user's session cookie for auth
        const cookieHeader = req.headers.get("cookie");
        const m = cookieHeader?.match(/(?:^|;\s*)session=([^;]+)/);
        const token = m ? decodeURIComponent(m[1]) : null;
        if (token) {
          await page.setCookie({ name: "session", value: token, url: "http://localhost:3000" });
        }
        const url = `http://localhost:3000/invoices/${id}/print?pdf=0`;
        await page.goto(url, { waitUntil: "domcontentloaded" });
        // Tunggu AppShell memuat settings dari API (atau lanjut setelah grace period kecil)
        await Promise.race([
          page.waitForResponse((resp) => resp.url().includes("/api/settings") && resp.status() === 200),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
        // Pastikan info bank tampil di halaman sebelum cetak (aman terhadap null)
        const accounts = ((settings?.bankAccounts as any[]) ?? []);
        const primary = accounts[0] || null;
        const primaryBankName = (primary?.bankName ?? settings?.bankName ?? "");
        const primaryAccountNumber = (primary?.accountNumber ?? settings?.bankAccount ?? "");
        await page.waitForFunction(
          (bn: string, acc: string) => {
            const text = document.body.innerText || "";
            const hasBank = bn ? text.includes(bn) : true;
            const hasAcc = acc ? text.includes(acc) : true;
            return hasBank && hasAcc;
          },
          { timeout: 5000 },
          primaryBankName,
          primaryAccountNumber
        );
        // Tunggu elemen utama kertas A4 muncul
        await page.waitForSelector("div.w-\\[210mm\\]", { timeout: 15000 });
        const buffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" } });
        return buffer;
      } finally {
        await browser.close();
      }
    }

    // Buat transporter dengan fallback: coba 465 (SSL), jika gagal coba 587 (STARTTLS)
    async function createTransportWithFallback() {
      // 465: SSL/TLS
      let t = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: smtpEmail, pass: smtpAppPassword },
      });
      try {
        await t.verify();
        return t;
      } catch {
        // 587: STARTTLS
        t = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: { user: smtpEmail, pass: smtpAppPassword },
        });
        await t.verify();
        return t;
      }
    }

    const transporter = await createTransportWithFallback();
    try {
      const pdfBuffer = await generateInvoicePdfWithPuppeteer();
      await transporter.sendMail({
        from: `${companyName} <${smtpEmail}>`,
        to: toEmail,
        subject,
        html,
        attachments: [
          {
            filename: `Invoice-${inv.id}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
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