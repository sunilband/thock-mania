import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const ANON_COOKIE = "kz-anon-uid";
const TWO_YEARS = 60 * 60 * 24 * 365 * 2;

export async function proxy(request: NextRequest) {
  // Refresh Supabase session
  const response = await updateSession(request);

  // Ensure anonymous UID cookie exists on every visitor
  if (!request.cookies.get(ANON_COOKIE)) {
    const uid = crypto.randomUUID();
    response.cookies.set(ANON_COOKIE, uid, {
      path: "/",
      maxAge: TWO_YEARS,
      sameSite: "lax",
      httpOnly: false,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ogg|mp3|wav)$).*)",
  ],
};
