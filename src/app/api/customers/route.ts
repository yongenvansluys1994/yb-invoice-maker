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
  const list = await prisma.customer.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const shaped = list.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.companyName ?? undefined,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    address: c.address ?? undefined,
    taxId: c.taxId ?? undefined,
  }));
  return NextResponse.json(shaped);
}

export async function POST(req: Request) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  const name: string | undefined = body?.name;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const created = await prisma.customer.create({
    data: {
      id: body?.id ?? undefined,
      userId,
      name,
      companyName: body?.company ?? null,
      email: body?.email ?? null,
      phone: body?.phone ?? null,
      address: body?.address ?? null,
      taxId: body?.taxId ?? null,
    },
  });
  const shaped = {
    id: created.id,
    name: created.name,
    company: created.companyName ?? undefined,
    email: created.email ?? undefined,
    phone: created.phone ?? undefined,
    address: created.address ?? undefined,
    taxId: created.taxId ?? undefined,
  };
  return NextResponse.json(shaped, { status: 201 });
}

export async function PUT(req: Request) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  const id: string | undefined = body?.id;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const updated = await prisma.customer.update({
    where: { id },
    data: {
      name: body?.name ?? undefined,
      companyName: body?.company ?? undefined,
      email: body?.email ?? undefined,
      phone: body?.phone ?? undefined,
      address: body?.address ?? undefined,
      taxId: body?.taxId ?? undefined,
    },
  });
  const shaped = {
    id: updated.id,
    name: updated.name,
    company: updated.companyName ?? undefined,
    email: updated.email ?? undefined,
    phone: updated.phone ?? undefined,
    address: updated.address ?? undefined,
    taxId: updated.taxId ?? undefined,
  };
  return NextResponse.json(shaped);
}

export async function DELETE(req: Request) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id: string | undefined = body?.id;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}