import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/me",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static assets
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check session cookie
  const token = req.cookies.get("session")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};