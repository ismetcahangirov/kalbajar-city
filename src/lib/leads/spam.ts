import "server-only";

import { createRateLimiter } from "@/lib/rate-limit";
import { minimumFillMs } from "@/shared/leads";

/** Lead submissions per client IP: five in ten minutes (#22). */
export const leadRateLimit = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

export type SpamReason = "honeypot" | "no-timing" | "too-fast" | "future";

/**
 * Why a submission looks automated, or `null` for a person. People never see
 * the honeypot, and they cannot fill a form within `minimumFillMs` of it
 * appearing; scripts posting straight to the API send no timing at all.
 */
export function spamReason(input: {
  website?: string;
  startedAt?: number;
  sentAt?: number;
}): SpamReason | null {
  if (input.website?.trim()) return "honeypot";
  if (input.startedAt === undefined || input.sentAt === undefined) return "no-timing";
  if (input.startedAt > input.sentAt) return "future";
  if (input.sentAt - input.startedAt < minimumFillMs) return "too-fast";
  return null;
}
