import { createAdminClient } from "@clinicalumia/api/admin";
import { deleteUnverifiedAccounts } from "@/lib/unverified-accounts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 });
  }
  const result = await deleteUnverifiedAccounts({
    admin: createAdminClient(),
    now: new Date(),
  });
  return Response.json(result, { status: "tooMany" in result ? 500 : 200 });
}
