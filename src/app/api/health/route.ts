import { connection } from "next/server";

export async function GET() {
  // Rendered per request so a container health check reflects the live process.
  await connection();
  return Response.json({ status: "ok" });
}
