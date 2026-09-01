import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

const PUBLIC_PREFIXES = ["/login", "/api/auth/login"];

export function proxy(request) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/logo.svg" ||
    pathname.startsWith("/brand")
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!isPublic && !hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
