import { handler } from "@/lib/api/handler";

/** The signed-in console user. Every role may read it. */
export const GET = handler({ auth: "user" }, ({ user }) => ({ user }));
