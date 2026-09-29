import { updateSession } from "@clinicalumia/api/proxy";
import { nextRoute } from "@clinicalumia/api/route";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const { response, user, step } = await updateSession(request);

  const decision = nextRoute({
    path: request.nextUrl.pathname,
    search: request.nextUrl.search,
    signedIn: Boolean(user),
    step,
  });

  if (!decision) return response;

  const target = new URL(decision.redirect, request.url);
  const url = request.nextUrl.clone();
  url.pathname = target.pathname;
  url.search = target.search;

  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|calendario/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
