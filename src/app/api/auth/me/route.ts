import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const m = cookieHeader?.match(/(?:^|;\s*)session=([^;]+)/);
    const token = m ? decodeURIComponent(m[1]) : null;
    if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || (session.expiresAt && session.expiresAt < new Date())) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const u = session.user;
    return NextResponse.json({ id: u.id, email: u.email, name: u.name ?? undefined }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}