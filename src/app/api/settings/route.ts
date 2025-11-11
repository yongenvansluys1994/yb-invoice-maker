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
  try {
    let userId: string | null = null;
    try {
      userId = await getSessionUserId(req);
    } catch (sessionError: any) {
      console.error("[SESSION ERROR GET]", sessionError);
      return NextResponse.json(
        { error: "Gagal memverifikasi sesi" },
        { status: 401 }
      );
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 }
      );
    }
    
    const s = await prisma.settings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    
    return NextResponse.json(s ?? {});
  } catch (error: any) {
    console.error("[SETTINGS GET ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengambil pengaturan" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    // Get user session with error handling
    let userId: string | null = null;
    try {
      userId = await getSessionUserId(req);
    } catch (sessionError: any) {
      console.error("[SESSION ERROR]", sessionError);
      return NextResponse.json(
        { error: "Gagal memverifikasi sesi. Silakan login ulang." },
        { status: 401 }
      );
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: "Tidak terautentikasi. Silakan login ulang." },
        { status: 401 }
      );
    }
    
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError: any) {
      console.error("[BODY PARSE ERROR]", parseError);
      return NextResponse.json(
        { error: "Data request tidak valid" },
        { status: 400 }
      );
    }
    
    // Update settings in database
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
