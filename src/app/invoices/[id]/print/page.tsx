"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { Invoice } from "@/types/invoice";
import { getSettings, fetchSettings, formatCurrency, formatDate } from "@/lib/settings";

export default function PrintInvoicePage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const pdfMode = useMemo(() => {
    const raw = search?.get("pdf");
    return raw !== null && raw !== undefined && String(raw).toLowerCase() !== "0" && String(raw).toLowerCase() !== "false";
  }, [search]);
  const serverMode = useMemo(() => {
    const raw = search?.get("server");
    return raw === "1";
  }, [search]);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [ready, setReady] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  // Muat settings dari server agar logo, pemilik, jabatan, dan rekening tampil saat dicetak via Puppeteer
  const [s, setS] = useState(getSettings());
  const displayId = useMemo(() => {
    if (!invoice) return "";
    try {
      const m = String(invoice.id || "").match(/^(.+)-(\d{8})-(\d+)$/);
      const dateKey = m?.[2] || "";
      const seqStr = m?.[3] || "";
      const prefix = (s.invoicePrefix || "INV").trim();
      return dateKey && seqStr ? `${prefix}-${dateKey}-${seqStr}` : `${prefix}-${invoice.id}`;
    } catch { return invoice.id; }
  }, [invoice, s.invoicePrefix]);

  useEffect(() => {
    (async () => {
      try {
        // Pastikan cookie sesi selalu terkirim agar API mengembalikan data saat diakses Puppeteer
        const res = await fetch(`/api/invoices/${params.id}`, { credentials: "include" });
        if (res.ok) {
          setInvoice(await res.json());
        } else {
          setInvoice(null);
        }
      } catch {
        setInvoice(null);
      }
    })();
  }, [params.id]);

  // Ambil pengaturan dari server (session), tapi prioritas logo dari localStorage
  useEffect(() => {
    (async () => {
      try {
        const localSettings = getSettings(); // Ambil lokal dulu (termasuk logo)
        const serverSettings = await fetchSettings();
        
        // Merge: gunakan server settings tapi pertahankan logo dari localStorage jika ada
        const merged = {
          ...serverSettings,
          // Logo dari localStorage dipertahankan (karena mungkin > 500KB tidak tersimpan di server)
          logoUrl: localSettings.logoUrl || serverSettings.logoUrl,
        };
        
        setS(merged);
      } catch {
        // Biarkan tetap pakai getSettings() jika gagal fetch
      }
    })();
  }, []);

  useEffect(() => {
    if (!invoice) return;
    const t = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(t);
  }, [invoice]);

  useEffect(() => {
    if (!ready) return;
    if (serverMode) {
      // Mode server: jangan panggil window.print atau generator PDF klien
      return;
    }
    if (pdfMode) {
      (async () => {
        try {
          const { default: html2canvas } = await import("html2canvas");
          const { default: jsPDF } = await import("jspdf");
          const node = sheetRef.current!;
          const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
          const imgData = canvas.toDataURL("image/png");
          const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const margin = 10;
          const renderWidth = pageWidth - margin * 2;
          const imgProps: any = (pdf as any).getImageProperties ? (pdf as any).getImageProperties(imgData) : { width: canvas.width, height: canvas.height };
          const imgWidth = imgProps.width;
          const imgHeight = imgProps.height;
          const ratio = renderWidth / imgWidth;
          const renderHeight = imgHeight * ratio;
          if (renderHeight <= pageHeight - margin * 2) {
            pdf.addImage(imgData, "PNG", margin, margin, renderWidth, renderHeight);
          } else {
            const pagePixelHeight = Math.floor(((pageHeight - margin * 2) / renderWidth) * imgWidth);
            const totalPixels = canvas.height;
            let offset = 0;
            const tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = canvas.width;
            tmpCanvas.height = pagePixelHeight;
            const tmpCtx = tmpCanvas.getContext("2d")!;
            while (offset < totalPixels) {
              tmpCtx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);
              tmpCtx.drawImage(canvas, 0, offset, canvas.width, pagePixelHeight, 0, 0, tmpCanvas.width, tmpCanvas.height);
              const partData = tmpCanvas.toDataURL("image/png");
              const partHeightMm = (pageHeight - margin * 2);
              pdf.addImage(partData, "PNG", margin, margin, renderWidth, partHeightMm);
              offset += pagePixelHeight;
              if (offset < totalPixels) pdf.addPage();
            }
          }
          pdf.save(`${invoice!.id}.pdf`);
          try { window.close(); } catch {}
        } catch (e) {
          console.error(e);
        }
      })();
    } else {
      try { window.print(); } catch {}
    }
  }, [ready, pdfMode, invoice]);

  if (!invoice) return <div className="p-6 text-sm">Sedang Memuat Invoice.</div>;

  const subtotal = invoice.items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const ppnRate = typeof s.defaultTaxRate === "number" ? s.defaultTaxRate : 0;
  const pphRate = typeof s.defaultPphRate === "number" ? s.defaultPphRate : 1.5;
  const ppnAmount = Math.round(subtotal * (ppnRate / 100));
  const pphAmount = Math.round(subtotal * (pphRate / 100));
  const grand = Math.round(subtotal + ppnAmount - pphAmount);

  return (
    <div className="p-6 print-wrapper">
      <style>{`
        @page { size: A4; margin: 0 }
        @media print {
          html, body { margin: 0; padding: 0 }
          .print-wrapper { padding: 0 !important }
        }
      `}</style>
      {/* Kertas A4 */}
      <div ref={sheetRef} className="relative mx-auto bg-white w-[210mm] min-h-[297mm] shadow-sm border border-black/10 text-black">
        {/* Header: logo kiri, di kanan nama perusahaan lalu alamat */}
        <div className="px-10 pt-10">
          <div className="flex items-start gap-6">
            <div className="h-16">
              {s.logoUrl ? (
                <img src={s.logoUrl} alt={s.companyName} className="h-16 w-auto object-contain" crossOrigin="anonymous" referrerPolicy="no-referrer" />
              ) : null}
            </div>
            <div className="flex-1">
              <div className="text-xl font-semibold">{s.companyName || "Nama Perusahaan"}</div>
              {s.address ? <div className="text-sm mt-1 whitespace-pre-line">{s.address}</div> : null}
            </div>
            <div className="ml-auto text-right">
              <div className="text-3xl font-bold tracking-wide">INVOICE</div>
              <div className="mt-2">No: {displayId || invoice.id}</div>
              <div>Tanggal: {formatDate(invoice.date)}</div>
              {invoice.dueDate ? <div>Jatuh Tempo: {formatDate(invoice.dueDate)}</div> : null}
              {s.npwp ? <div className="text-black/70 mt-1">NPWP: {s.npwp}</div> : null}
            </div>
          </div>
        </div>

        {/* Penerima */}
        <div className="px-10 mt-6 text-sm">
          <div className="font-semibold">Kepada</div>
          <div className="mt-1">{invoice.clientName}</div>
        </div>

        {/* Tabel item */}
        <div className="px-10 mt-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Deskripsi</th>
                <th className="text-right py-2">Harga Satuan</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it) => {
                const line = it.unitPrice * it.quantity;
                return (
                  <tr key={it.id} className="border-b">
                    <td className="py-2 pr-4">{it.description}</td>
                    <td className="py-2 text-right">{formatCurrency(it.unitPrice)}</td>
                    <td className="py-2 text-right">{it.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(line)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Ringkasan total */}
        <div className="px-10 mt-6 flex justify-end">
          <div className="w-[280px] text-sm">
            <div className="flex justify-between py-1">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Pajak PPN ({ppnRate}%)</span>
              <span>{formatCurrency(ppnAmount)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Pph ({pphRate}%)</span>
              <span>{formatCurrency(pphAmount)}</span>
            </div>
            <div className="flex justify-between py-1 font-semibold border-t mt-2 pt-2">
              <span>Total</span>
              <span>{formatCurrency(grand)}</span>
            </div>
          </div>
        </div>

        {/* Instruksi pembayaran / Rekening bank */}
        <div className="px-10 mt-6 text-sm">
          <div className="font-medium">Pembayaran</div>
          {(s.bankAccounts?.length || 0) > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-4">
              {s.bankAccounts.map((b, idx) => (
                <div key={idx} className="rounded-lg border border-black/10 p-3">
                  <div className="font-semibold">{b.bankName}</div>
                  <div>No. Rekening: {b.accountNumber}</div>
                  {b.alias ? <div className="text-black/70">Alias: {b.alias}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-black/70 mt-1">{s.bankName} - {s.bankAccount}</div>
          )}
        </div>

        {/* Tanda tangan (kanan bawah) */}
        <div className="px-10 mt-16 mb-20">
          <div className="flex justify-end">
            <div className="w-[160px] text-sm text-left">
              <div>Hormat Kami,</div>
              <div className="font-semibold">{s.companyName}</div>
              <br />
              <br />
              <br />
              <div className="font-semibold">{s.ownerName || "Nama Pemilik Usaha"}</div>
              <div className="text-black/70">{s.ownerTitle || "Jabatan"}</div>
            </div>
          </div>
        </div>
        {invoice.status === "lunas" ? (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div style={{ fontSize: "160px", fontWeight: 800, color: "rgba(107,114,128,0.12)", transform: "rotate(-20deg)", textShadow: "none" }}>
              LUNAS
            </div>
          </div>
        ) : null}
        {/* Marker siap cetak (untuk Puppeteer menunggu readiness) */}
        {ready ? <div id="print-ready" data-ok="1" style={{ display: "none" }} /> : null}
      </div>
    </div>
  );
}