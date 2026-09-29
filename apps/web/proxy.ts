import { updateSession } from "@clinicalumia/api/proxy";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  matcher: ["/reservar/:path*", "/acceder/:path*", "/mi-cuenta/:path*"],
};
