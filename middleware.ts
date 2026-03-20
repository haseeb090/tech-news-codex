import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { isLocalRequest } from "@/lib/auth/access";

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const isAdminApiRoute = (pathname: string): boolean => pathname.startsWith("/api/admin");

const denyAdminAccess = (request: NextRequest): NextResponse => {
  if (isAdminApiRoute(request.nextUrl.pathname)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.redirect(new URL("/", request.url));
};

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const targetsAdminSurface =
    pathname === "/login" || pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!targetsAdminSurface) {
    return NextResponse.next();
  }

  const adminEnabled = parseBoolean(process.env.ADMIN_ENABLED, process.env.NODE_ENV !== "production");
  const adminLocalOnly = parseBoolean(process.env.ADMIN_LOCAL_ONLY, true);
  const authSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

  if (!adminEnabled) {
    return denyAdminAccess(request);
  }

  if (adminLocalOnly && !isLocalRequest(request)) {
    return denyAdminAccess(request);
  }

  if (pathname === "/login") {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: authSecret });
  if (!token || token.role !== "admin") {
    if (isAdminApiRoute(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/admin/:path*", "/api/admin/:path*"],
};
