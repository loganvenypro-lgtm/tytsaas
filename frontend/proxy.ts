import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// Optimistic check on the cookie only; pages verify the session with
// requireSession() before rendering anything private.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
}
