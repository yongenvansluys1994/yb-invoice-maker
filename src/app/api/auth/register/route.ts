import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const name = body?.name ? String(body.name).trim() : null;

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash: hash, name: name || undefined } });

    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Gagal mendaftar" }, { status: 500 });
  }
}