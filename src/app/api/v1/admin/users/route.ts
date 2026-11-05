import { getDb } from "@/db";
import { listUsers } from "@/lib/admin/users";
import { handler } from "@/lib/api/handler";

export const GET = handler({ auth: { user: ["list"] } }, ({ user }) => listUsers(getDb(), user));
