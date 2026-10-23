import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// Optimistic check on the cookie only; the (app) layout verifies the session
// with requireSession() before rendering anything private.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    // Signed-out visitors land on the public page, deep links go to the sign-in and back
    const { pathname, search } = request.nextUrl
    if (pathname === "/") return NextResponse.redirect(new URL("/welcome", request.url))
    const login = new URL("/login", request.url)
    login.searchParams.set("next", pathname + search)
    return NextResponse.redirect(login)
  }
  return NextResponse.next()
}

export const config = {
  // Every page except the auth pages (password reset included), the landing pages, invitations (they explain how to sign in),
  // share links (/share/<token>, public), the blog, the API (proxied to the backend), PostHog (/ingest) and static files
  matcher: ["/((?!login|signup|forgot-password|reset-password|welcome2|welcome|blog|invite|share/|api|ingest|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
