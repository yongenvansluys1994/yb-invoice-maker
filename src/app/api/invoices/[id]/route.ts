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

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await context.params;
  let inv = await prisma.invoice.findUnique({ where: { id }, include: { items: true } });
  // Dukung short id di URL: jika tidak ditemukan secara unique, coba cari berdasarkan akhiran "-YYYYMMDD-SEQ" untuk user yang sama
  if (!inv || inv.userId !== userId) {
    const m = id.match(/^(\d{8})-(\d+)$/);
    if (m) {
      inv = await prisma.invoice.findFirst({
        where: { userId, id: { endsWith: `-${m[1]}-${m[2]}` } },
        include: { items: true },
      });
    }
  }
  if (!inv || inv.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const shaped: Invoice = {
    id: inv.id,
    clientName: inv.clientName,
    date: inv.date,
    dueDate: inv.dueDate ?? undefined,
    status: inv.status,
    note: inv.note ?? undefined,
    total: inv.total,
    items: inv.items.map((it) => ({ id: it.id, description: it.description, unitPrice: it.unitPrice, quantity: it.quantity, taxRate: it.taxRate ?? undefined })),
    customerId: inv.customerId ?? undefined,
  };
  return NextResponse.json(shaped);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await context.params;
  const body = (await req.json()) as Partial<Invoice>;
  const hasItems = Array.isArray(body.items);
  // Gunakan pajak global dari Settings
  const s = await prisma.settings.findUnique({ where: { userId } });
  const ppnRate = typeof s?.defaultTaxRate === "number" ? s!.defaultTaxRate : 0;
  const pphRate = typeof (s as any)?.defaultPphRate === "number" ? (s as any).defaultPphRate : 1.5;
  const itemsWithAmount = hasItems
    ? body.items!.map((it) => {
        const base = it.unitPrice * it.quantity;
        return { ...it, amount: base };
      })
    : undefined;
  const subtotalBase = itemsWithAmount ? itemsWithAmount.reduce((sum, it) => sum + it.amount, 0) : undefined;
  const total = typeof subtotalBase === "number"
    ? subtotalBase + Math.round(subtotalBase * (ppnRate / 100)) - Math.round(subtotalBase * (pphRate / 100))
    : undefined;

  // Temukan invoice baik dengan full id maupun short id
  let existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    const m = id.match(/^(\d{8})-(\d+)$/);
    if (m) {
      existing = await prisma.invoice.findFirst({ where: { userId, id: { endsWith: `-${m[1]}-${m[2]}` } } });
    }
  }
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.invoice.update({
    where: { id: existing.id },
    data: {
      clientName: body.clientName ?? undefined,
      date: body.date ?? undefined,
      dueDate: body.dueDate ?? undefined,
      status: body.status ?? undefined,
      note: body.note ?? undefined,
      total: total ?? undefined,
      customerId: body.customerId ?? undefined,
    },
  });

  if (itemsWithAmount) {
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
    for (const it of itemsWithAmount) {
      await prisma.invoiceItem.create({
        data: {
          invoiceId: existing.id,
          description: it.description,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          taxRate: null,
          amount: it.amount,
        },
      });
    }
  }

  const final = await prisma.invoice.findUnique({ where: { id: existing.id }, include: { items: true } });
  if (!final || final.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const shaped: Invoice = {
    id: final.id,
    clientName: final.clientName,
    date: final.date,
    dueDate: final.dueDate ?? undefined,
    status: final.status,
    note: final.note ?? undefined,
    total: final.total,
    items: final.items.map((it) => ({ id: it.id, description: it.description, unitPrice: it.unitPrice, quantity: it.quantity, taxRate: it.taxRate ?? undefined })),
    customerId: final.customerId ?? undefined,
  };
  return NextResponse.json(shaped);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await context.params;
  try {
    // Temukan invoice baik dengan full id maupun short id
    let existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      const m = id.match(/^(\d{8})-(\d+)$/);
      if (m) {
        existing = await prisma.invoice.findFirst({ where: { userId, id: { endsWith: `-${m[1]}-${m[2]}` } } });
      }
    }
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.invoice.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}