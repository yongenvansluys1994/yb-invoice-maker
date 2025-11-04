"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { Invoice } from "@/types/invoice";
import { getSettings, formatCurrency, formatDate } from "@/lib/settings";

type Payment = { id: string; invoiceId: string; amount: number; date: string; method: string; note?: string };

export default function PrintReceiptPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const pdfMode = useMemo(() => {
    const raw = search?.get("pdf");
    return raw !== null && raw !== undefined && String(raw).toLowerCase() !== "0" && String(raw).toLowerCase() !== "false";
  }, [search]);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ready, setReady] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const s = useMemo(() => getSettings(), []);
  const displayId = useMemo(() => {
    if (!invoice) return "";
    try {
      const m = invoice.id.match(/^(.+)-(\d{8})-(\d+)$/);
      const dateKey = m?.[2] || "";
      const seqStr = m?.[3] || "";
      const prefix = (s.invoicePrefix || "INV").trim();
      return dateKey && seqStr ? `${prefix}-${dateKey}-${seqStr}` : `${prefix}-${invoice.id}`;
    } catch { return invoice.id; }
  }, [invoice, s.invoicePrefix]);

  useEffect(() => {
    (async () => {
      try {
        const [resInv, resPay] = await Promise.all([
          fetch(`/api/invoices/${params.id}`),
          fetch(`/api/payments?invoiceId=${encodeURIComponent(params.id)}`),
        ]);
        const inv = resInv.ok ? await resInv.json() : null;
        setInvoice(inv);
        const pay = resPay.ok ? await resPay.json() : [];
        setPayments(pay);
      } catch {
        setInvoice(null);
        setPayments([]);
      }
    })();
  }, [params.id]);

  useEffect(() => {
    if (!invoice) return;
    const t = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(t);
  }, [invoice]);

  useEffect(() => {
    if (!ready) return;
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
          pdf.save(`${invoice!.id}-kwitansi.pdf`);
          try { window.close(); } catch {}
        } catch (e) {
          console.error(e);
        }
      })();
    } else {
      try { window.print(); } catch {}
    }
  }, [ready, pdfMode, invoice]);

  if (!invoice) return <div className="p-6 text-sm">Kwitansi tidak ditemukan atau gagal dimuat.</div>;

  const paidTotal = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="p-6">
      {/* Kertas A4 */}
      <div ref={sheetRef} className="relative mx-auto bg-white w-[210mm] min-h-[297mm] shadow-sm border border-black/10 text-black">
        {/* Header: logo kiri, kanan KWITANSI dan info */}
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
              <div className="text-3xl font-bold tracking-wide">KWITANSI</div>
              <div className="mt-2">No: {displayId || invoice.id}</div>
              <div>Tanggal: {formatDate(invoice.date)}</div>
              {s.npwp ? <div className="text-black/70 mt-1">NPWP: {s.npwp}</div> : null}
            </div>
          </div>
        </div>

        {/* Info penerimaan */}
        <div className="px-10 mt-6 text-sm">
          <div className="rounded-lg border border-black/10 p-4 bg-black/5 print:bg-transparent">
            <div className="mb-2">Telah diterima dari: <span className="font-semibold">{invoice.clientName}</span></div>
            <div className="mb-2">Sejumlah: <span className="font-semibold">{formatCurrency(paidTotal)}</span></div>
            <div className="mb-2">Untuk pembayaran invoice <span className="font-semibold">{displayId || invoice.id}</span></div>
          </div>
        </div>

        {/* Rincian pembayaran */}
        <div className="px-10 mt-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Tanggal</th>
                <th className="text-left py-2">Metode</th>
                <th className="text-right py-2">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-2">{formatDate(p.date)}</td>
                  <td className="py-2">{p.method}</td>
                  <td className="py-2 text-right">{formatCurrency(p.amount)}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-black/60">Belum ada pembayaran tercatat.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Total diterima */}
        <div className="px-10 mt-6 flex justify-end">
          <div className="w-[280px] text-sm">
            <div className="flex justify-between py-1 font-semibold border-t mt-2 pt-2">
              <span>Total Diterima</span>
              <span>{formatCurrency(paidTotal)}</span>
            </div>
          </div>
        </div>

        {/* Tanda tangan */}
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
      </div>
    </div>
  );
}