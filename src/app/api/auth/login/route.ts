import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

// Pastikan route ini menggunakan Node.js runtime (bukan Edge)
export const runtime = "nodejs";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "Email tidak ditemukan" }, { status: 404 });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Password salah" }, { status: 401 });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
    await prisma.session.create({ data: { userId: user.id, token, expiresAt } });

    const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } }, { status: 200 });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (e) {
    // Log detail error untuk membantu debugging di Railway
    try { console.error("[login] error:", e); } catch {}
    return NextResponse.json({ error: "Gagal login" }, { status: 500 });
  }
}