import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "session";

export async function GET(req: Request) {
  try {
    const token = await getSessionToken(req);
    if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || (session.expiresAt && session.expiresAt < new Date())) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    const u = session.user;
    return NextResponse.json({ id: u.id, email: u.email, name: u.name }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}

async function getSessionToken(req: Request): Promise<string | null> {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}