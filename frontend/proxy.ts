import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// Optimistic check on the cookie only; the (app) layout verifies the session
// with requireSession() before rendering anything private.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return NextResponse.next()
}

export const config = {
  // Every page except the auth pages, the API (proxied to the backend) and static files
  matcher: ["/((?!login|signup|api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
