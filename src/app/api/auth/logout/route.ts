import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "session";

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const m = cookieHeader?.match(/(?:^|;\s*)session=([^;]+)/);
    const token = m ? decodeURIComponent(m[1]) : null;

    if (token) {
      await prisma.session.delete({ where: { token } }).catch(() => {});
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Gagal logout" }, { status: 500 });
  }
}