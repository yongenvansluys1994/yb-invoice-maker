import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "session";

export async function POST(req: Request) {
  try {
    const cookie = (req as any).cookies?.get?.(SESSION_COOKIE)?.value; // Fallback untuk kompatibilitas
    const token = cookie || (await getCookieFromHeader(req));
    if (token) {
      await prisma.session.deleteMany({ where: { token } });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }
}

async function getCookieFromHeader(req: Request): Promise<string | null> {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}