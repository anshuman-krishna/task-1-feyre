import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/sign-in", "/api/auth/sign-in", "/api/health"];

// edge-safe cookie check. signature verification + db lookup happen
// in server components / route handlers via getCurrentUser().
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const session = req.cookies.get("mira_session")?.value;
  if (!session || !session.includes(".")) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: { message: "unauthorized", code: "unauthorized" } },
        { status: 401 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon|.*\\.svg).*)"],
};
