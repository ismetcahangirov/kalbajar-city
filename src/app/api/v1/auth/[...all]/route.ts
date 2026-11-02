import { getAuth } from "@/lib/auth";

// Better Auth's endpoints (sign-in, sign-out, password reset, the admin
// plugin), under /api/v1/auth. The instance is created on the first request.
export function GET(request: Request) {
  return getAuth().handler(request);
}

export function POST(request: Request) {
  return getAuth().handler(request);
}
