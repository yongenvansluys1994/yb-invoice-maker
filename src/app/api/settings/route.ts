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
  try {
    const userId = await getSessionUserId(req);
    if (!userId) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    
    const body = await req.json();
    
    const updated = await prisma.settings.upsert({
      where: { userId },
      update: body,
      create: { userId, ...body },
    });
    
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[SETTINGS PATCH ERROR]", error);
    
    // Database connection error
    if (error.code === 'P1001' || error.code === 'P1002') {
      return NextResponse.json(
        { error: "Tidak dapat terhubung ke database" },
        { status: 503 }
      );
    }
    
    // Unique constraint error
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "Data sudah ada" },
        { status: 409 }
      );
    }
    
    // Invalid data error
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: "Data tidak valid" },
        { status: 400 }
      );
    }
    
    // Generic error
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan saat menyimpan pengaturan" },
      { status: 500 }
    );
  }
}
