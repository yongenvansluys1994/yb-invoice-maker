import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const date = sp.get("date") || new Date().toISOString().slice(0, 10);
  const dateKey = date.replaceAll("-", "");
  const settings = await prisma.settings.findUnique({ where: { userId } });
  const rawPrefix = (settings?.invoicePrefix || "INV").trim();
  // Sanitasi prefix agar aman dipakai sebagai bagian dari URL dan primary key
  // Ganti karakter pemisah path ("/" dan "\\") menjadi "-"
  const prefix = rawPrefix.replace(/[\/\\]/g, "-");

  const likePrefix = `${prefix}-${dateKey}-`;
  // Cari semua invoice dengan prefix & tanggal yang sama secara global untuk menghindari bentrok antar user
  const existing = await prisma.invoice.findMany({ where: { id: { startsWith: likePrefix } }, select: { id: true } });
  let maxSeq = 0;
  for (const e of existing) {
    const parts = e.id.split("-");
    const last = parts[parts.length - 1];
    const n = Number(last);
    if (!Number.isNaN(n)) maxSeq = Math.max(maxSeq, n);
  }
  const next = maxSeq + 1;
  const seqStr = String(next).padStart(3, "0");
  const id = `${prefix}-${dateKey}-${seqStr}`;
  return NextResponse.json({ id });
}