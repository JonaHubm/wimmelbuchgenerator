import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, getAccessGateConfig, verifyAccessToken } from "@/lib/access-control";

const PUBLIC_FILE_PATTERN = /\.(?:avif|css|gif|ico|jpg|jpeg|js|json|png|svg|txt|webp|xml)$/i;

function isPublicPath(pathname: string) {
  return (
    pathname === "/access" ||
    pathname === "/access/" ||
    pathname === "/api/access" ||
    pathname === "/api/access/" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/wimmelbuchgenerator/_next/") ||
    pathname === "/favicon.ico" ||
    PUBLIC_FILE_PATTERN.test(pathname)
  );
}

function apiResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const config = getAccessGateConfig();

  if (!config.enabled) {
    return NextResponse.next();
  }

  if (!config.configured) {
    if (pathname.startsWith("/api/")) {
      return apiResponse("Private access is not configured on the server.", 503);
    }

    return NextResponse.redirect(new URL("/access", request.url));
  }

  const hasAccess = await verifyAccessToken(request.cookies.get(ACCESS_COOKIE_NAME)?.value);

  if (hasAccess) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return apiResponse("Private test access is required.", 401);
  }

  const accessUrl = new URL("/access", request.url);
  accessUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(accessUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
