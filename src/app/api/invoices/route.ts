import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { Invoice } from "@/types/invoice";

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
  const page = Math.max(1, Number(sp.get("page") || 1));
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") || 100)));
  const status = sp.get("status") as any;
  const q = sp.get("q")?.trim() || "";
  const from = sp.get("from") || undefined;
  const to = sp.get("to") || undefined;

  const where: any = {};
  where.userId = userId;
  if (status) where.status = status;
  if (q) where.OR = [{ id: { contains: q } }, { clientName: { contains: q, mode: "insensitive" } }];
  if (from || to) where.date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const [list, totalCount] = await Promise.all([
    prisma.invoice.findMany({ where, include: { items: true }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.invoice.count({ where }),
  ]);

  const shaped: Invoice[] = list.map((i) => ({
    id: i.id,
    clientName: i.clientName,
    date: i.date,
    dueDate: i.dueDate ?? undefined,
    status: i.status,
    note: i.note ?? undefined,
    total: i.total,
    items: i.items.map((it) => ({ id: it.id, description: it.description, unitPrice: it.unitPrice, quantity: it.quantity, taxRate: it.taxRate ?? undefined })),
    customerId: i.customerId ?? undefined,
  }));
  const res = NextResponse.json(shaped);
  res.headers.set("X-Total-Count", String(totalCount));
  res.headers.set("X-Page", String(page));
  res.headers.set("X-Limit", String(limit));
  return res;
}

export async function POST(req: Request) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = (await req.json()) as Invoice;
  // Hitung pajak global berdasarkan Settings
  const s = await prisma.settings.findUnique({ where: { userId } });
  const ppnRate = typeof s?.defaultTaxRate === "number" ? s!.defaultTaxRate : 0;
  const pphRate = typeof (s as any)?.defaultPphRate === "number" ? (s as any).defaultPphRate : 1.5;
  const itemsWithAmount = body.items.map((it) => {
    const base = it.unitPrice * it.quantity;
    return { ...it, amount: base };
  });
  const subtotalBase = itemsWithAmount.reduce((sum, it) => sum + it.amount, 0);
  const ppnAmount = Math.round(subtotalBase * (ppnRate / 100));
  const pphAmount = Math.round(subtotalBase * (pphRate / 100));
  const total = subtotalBase + ppnAmount - pphAmount;
  try {
    const created = await prisma.invoice.create({
      data: {
        userId,
        id: body.id,
        clientName: body.clientName,
        date: body.date,
        dueDate: body.dueDate ?? null,
        status: body.status ?? undefined,
        note: body.note ?? null,
        total,
        customerId: body.customerId ?? null,
        items: {
          create: itemsWithAmount.map((it) => ({
            description: it.description,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            taxRate: null,
            amount: it.amount,
          })),
        },
      },
      include: { items: true },
    });
    const shaped: Invoice = {
      id: created.id,
      clientName: created.clientName,
      date: created.date,
      dueDate: created.dueDate ?? undefined,
      status: created.status,
      note: created.note ?? undefined,
      total: created.total,
      items: created.items.map((it) => ({ id: it.id, description: it.description, unitPrice: it.unitPrice, quantity: it.quantity, taxRate: it.taxRate ?? undefined })),
      customerId: created.customerId ?? undefined,
    };
    return NextResponse.json(shaped, { status: 201 });
  } catch (e: any) {
    const code = e?.code;
    if (code === "P2002") {
      // Unique constraint failed on id (kemungkinan bentrok dengan invoice user lain)
      return NextResponse.json({ error: "Nomor invoice sudah digunakan. Ubah tanggal atau coba lagi untuk mengambil nomor baru." }, { status: 409 });
    }
    const msg = typeof e?.message === "string" ? e.message : "Gagal membuat invoice";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}