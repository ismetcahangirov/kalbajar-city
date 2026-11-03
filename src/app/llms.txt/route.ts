import { connection } from "next/server";

import { llmsResponse } from "@/lib/public/llms";

/** `llms.txt` in English, generated from the database (#29). */
export async function GET() {
  await connection();
  return llmsResponse("en");
}
