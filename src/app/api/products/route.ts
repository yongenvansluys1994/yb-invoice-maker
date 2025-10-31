import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function getSessionUserId(req: Request): Promise<string | null> {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  const token = m ? decodeURIComponent(m[1]) : null;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || (session.expiresAt && session.expiresAt < new Date())) return null;
  return session.user.id;
}

export async function GET(req: Request) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const list = await prisma.product.findMany({ where: { userId, active: true }, orderBy: { createdAt: "asc" } });
  const shaped = list.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? undefined,
    price: p.price,
    unit: p.unit ?? undefined,
    taxRate: p.taxRate ?? undefined,
    active: p.active,
  }));
  return NextResponse.json(shaped);
}

export async function POST(req: Request) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  const name: string | undefined = body?.name;
  const price: number | undefined = body?.price;
  if (!name || typeof price !== "number") {
    return NextResponse.json({ error: "name and price are required" }, { status: 400 });
  }
  const created = await prisma.product.create({
    data: {
      id: body?.id ?? undefined,
      userId,
      name,
      description: body?.description ?? null,
      price,
      unit: body?.unit ?? null,
      taxRate: body?.taxRate ?? null,
      active: body?.active ?? true,
    },
  });
  const shaped = {
    id: created.id,
    name: created.name,
    description: created.description ?? undefined,
    price: created.price,
    unit: created.unit ?? undefined,
    taxRate: created.taxRate ?? undefined,
    active: created.active,
  };
  return NextResponse.json(shaped, { status: 201 });
}

export async function PUT(req: Request) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  const id: string | undefined = body?.id;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const updated = await prisma.product.update({
    where: { id },
    data: {
      name: body?.name ?? undefined,
      description: body?.description ?? undefined,
      price: typeof body?.price === "number" ? body.price : undefined,
      unit: typeof body?.unit === "string" ? body.unit : undefined,
      taxRate: typeof body?.taxRate === "number" ? body.taxRate : undefined,
      active: typeof body?.active === "boolean" ? body.active : undefined,
    },
  });
  const shaped = {
    id: updated.id,
    name: updated.name,
    description: updated.description ?? undefined,
    price: updated.price,
    unit: updated.unit ?? undefined,
    taxRate: updated.taxRate ?? undefined,
    active: updated.active,
  };
  return NextResponse.json(shaped);
}

export async function DELETE(req: Request) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id: string | undefined = body?.id;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}