/**
 * The privacy notice's figures. The retention period is the owner's decision
 * (#7): 24 months is the proposal the notice states until they confirm it.
 * Change `updated` whenever the notice's substance changes.
 */
export const privacy = {
  /** How long a lead (a request from a form) is kept after the last contact about it. */
  retentionMonths: 24,
  /** The date the notice last changed, `YYYY-MM-DD`. */
  updated: "2026-11-02",
} as const;
