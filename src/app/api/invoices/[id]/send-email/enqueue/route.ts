import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let body: any = {};
  try { body = await req.json(); } catch {}
  const origin = (req as any)?.nextUrl?.origin || "http://localhost:3000";
  const cookieHeader = req.headers.get("cookie") || "";

  // Jalankan pengiriman email di background agar UI tidak menunggu lama
  setTimeout(async () => {
    try {
      await fetch(`${origin}/api/invoices/${id}/send-email`, {
        method: "POST",
        headers: { "content-type": "application/json", "cookie": cookieHeader },
        body: JSON.stringify(body || {}),
      });
    } catch (err) {
      console.error("enqueue send-email error:", (err as any)?.message || err);
    }
  }, 10);

  return NextResponse.json({ ok: true, enqueued: true, id }, { status: 202 });
}