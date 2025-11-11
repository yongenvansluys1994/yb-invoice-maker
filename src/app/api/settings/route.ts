import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Next.js App Router tidak support bodyParser config
// Body size limit di-handle secara manual di handler

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
    
    // Parse request body with comprehensive error handling
    let body;
    try {
      // Check content length first
      const contentLength = req.headers.get('content-length');
      const contentLengthNum = contentLength ? parseInt(contentLength) : 0;
      console.log('[SETTINGS] Content-Length:', contentLength, 'bytes');
      
      // Check if request body is too large
      // Railway has ~512KB-1MB body size limit by default
      const MAX_SIZE = 1 * 1024 * 1024; // 1MB (Railway safe limit)
      if (contentLengthNum > MAX_SIZE) {
        console.error('[SETTINGS] Request too large:', contentLengthNum, 'bytes');
        return NextResponse.json(
          { error: `Request terlalu besar (${(contentLengthNum / 1024).toFixed(0)}KB). Maksimal 1MB.` },
          { status: 413 }
        );
      }
      
      // Try to read and parse body
      let bodyText: string;
      try {
        bodyText = await req.text();
        console.log('[SETTINGS] Body text length:', bodyText.length, 'bytes');
      } catch (readError: any) {
        console.error('[SETTINGS] Error reading body:', readError.message);
        return NextResponse.json(
          { error: 'Gagal membaca request body' },
          { status: 400 }
        );
      }
      
      // Try to parse as JSON
      try {
        body = JSON.parse(bodyText);
        console.log('[SETTINGS] Body parsed successfully, keys:', Object.keys(body).join(', '));
      } catch (jsonError: any) {
        console.error('[SETTINGS] JSON parse error:', {
          message: jsonError.message,
          position: jsonError.message.match(/position (\d+)/)?.[1],
          bodyPreview: bodyText.substring(0, 100)
        });
        return NextResponse.json(
          { error: 'Data JSON tidak valid' },
          { status: 400 }
        );
      }
      
      // Validate body structure
      if (!body || typeof body !== 'object') {
        console.error('[SETTINGS] Body is not an object:', typeof body);
        return NextResponse.json(
          { error: 'Format data tidak valid' },
          { status: 400 }
        );
      }
      
      // Check if logoUrl is too large
      // Logo should be max 500KB (Railway constraint)
      const MAX_LOGO_SIZE = 500 * 1024; // 500KB
      if (body.logoUrl && typeof body.logoUrl === 'string' && body.logoUrl.length > MAX_LOGO_SIZE) {
        console.warn('[SETTINGS] Logo too large:', body.logoUrl.length, 'bytes');
        return NextResponse.json(
          { error: `Logo terlalu besar (${(body.logoUrl.length / 1024).toFixed(0)}KB). Maksimal 500KB.` },
          { status: 413 }
        );
      }
      
      console.log('[SETTINGS] Validation passed, proceeding to upsert');
    } catch (parseError: any) {
      console.error("[BODY PARSE ERROR OUTER]", {
        message: parseError.message,
        name: parseError.name,
        stack: parseError.stack?.substring(0, 300)
      });
      return NextResponse.json(
        { error: `Error tidak terduga: ${parseError.message}` },
        { status: 500 }
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
