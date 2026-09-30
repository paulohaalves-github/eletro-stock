import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

const PUBLIC_PREFIXES = ["/login", "/api/auth/login", "/api/integrations/whatsapp", "/catalogo", "/api/catalog"];

function isCatalogPath(pathname) {
  return pathname === "/catalogo" || pathname.startsWith("/catalogo/") || pathname === "/api/catalog" || pathname.startsWith("/api/catalog/");
}

function isCatalogHost(request) {
  const configured = String(process.env.CATALOG_HOST || "").trim().toLowerCase();
  if (!configured) return false;
  const host = String(request.headers.get("host") || "").split(":")[0].toLowerCase();
  return host === configured;
}

export function proxy(request) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/logo.svg" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname.startsWith("/brand")
  ) {
    return NextResponse.next();
  }

  if (isCatalogHost(request)) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/catalogo";
      return NextResponse.rewrite(url);
    }
    if (!isCatalogPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/catalogo";
      url.search = "";
      return NextResponse.redirect(url);
    }
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
