import { authorize } from "@/lib/auth/session";

/** The signed-in console user. Every role may read it. */
export async function GET(request: Request) {
  const { user, response } = await authorize(request);
  if (response) return response;
  return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
}
