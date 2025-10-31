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
  const s = await prisma.settings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return NextResponse.json(s ?? {});
}

export async function PATCH(req: Request) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  const updated = await prisma.settings.upsert({
    where: { userId },
    update: body,
    create: { userId, ...body },
  });
  return NextResponse.json(updated);
}