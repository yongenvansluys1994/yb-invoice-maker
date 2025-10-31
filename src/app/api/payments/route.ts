import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type PaymentShape = { id: string; invoiceId: string; amount: number; date: string; method: string; note?: string };

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
  const invoiceId = sp.get("invoiceId") || undefined;
  const where: any = invoiceId ? { userId, invoiceId } : { userId };
  const list = await prisma.payment.findMany({ where, orderBy: { date: "desc" } });
  const shaped: PaymentShape[] = list.map((p) => ({ id: p.id, invoiceId: p.invoiceId, amount: p.amount, date: p.date, method: p.method, note: p.note ?? undefined }));
  return NextResponse.json(shaped);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  const { invoiceId, amount, date, method, note } = body || {};
  if (!invoiceId || !amount || amount <= 0 || !date || !method) {
    return NextResponse.json({ error: "Invalid payment data" }, { status: 400 });
  }
  // ensure invoice exists
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv || inv.userId !== userId) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  const created = await prisma.payment.create({ data: { userId, invoiceId, amount, date, method, note: note ?? null } });

  // update invoice status if fully paid
  const agg = await prisma.payment.aggregate({ where: { userId, invoiceId }, _sum: { amount: true } });
  const paidTotal = agg._sum.amount ?? 0;
  const shouldBeLunas = paidTotal >= inv.total;
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: shouldBeLunas ? "lunas" : "terkirim" } });

  const shaped: PaymentShape = { id: created.id, invoiceId: created.invoiceId, amount: created.amount, date: created.date, method: created.method, note: created.note ?? undefined };
  return NextResponse.json(shaped, { status: 201 });
}