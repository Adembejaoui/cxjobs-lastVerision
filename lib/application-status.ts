/**
 * Application status workflow (launch plan A7). Client-safe: used by the
 * API (enforcement) and by the recruiter UI (which options to offer).
 *
 *   NOUVEAU (new) ─┬─> EN_COURS_EXAMEN (in review) ─┬─> ENTRETIEN (interview) ─┬─> EMBAUCHES (hired)
 *                  ├─> ENTRETIEN                     ├─> EMBAUCHES               ├─> EN_COURS_EXAMEN
 *                  └─> REFUSE (rejected)             └─> REFUSE                  └─> REFUSE
 *   REFUSE    ─> EN_COURS_EXAMEN   (reconsider: back through review, never straight to hired)
 *   EMBAUCHES ─> REFUSE            (offer withdrawn or declined)
 *
 * Not allowed, among others: REFUSE → EMBAUCHES / ENTRETIEN, NOUVEAU → EMBAUCHES,
 * anything → NOUVEAU. Keeping the same status is always allowed (no-op).
 */

export const APPLICATION_STATUSES = ["NOUVEAU", "EN_COURS_EXAMEN", "ENTRETIEN", "EMBAUCHES", "REFUSE"] as const;
export type ApplicationStatusValue = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_TRANSITIONS: Record<ApplicationStatusValue, readonly ApplicationStatusValue[]> = {
  NOUVEAU: ["EN_COURS_EXAMEN", "ENTRETIEN", "REFUSE"],
  EN_COURS_EXAMEN: ["ENTRETIEN", "EMBAUCHES", "REFUSE"],
  ENTRETIEN: ["EN_COURS_EXAMEN", "EMBAUCHES", "REFUSE"],
  REFUSE: ["EN_COURS_EXAMEN"],
  EMBAUCHES: ["REFUSE"],
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatusValue, string> = {
  NOUVEAU: "New",
  EN_COURS_EXAMEN: "In Review",
  ENTRETIEN: "Interview",
  EMBAUCHES: "Hired",
  REFUSE: "Rejected",
};

export function isApplicationStatus(value: unknown): value is ApplicationStatusValue {
  return typeof value === "string" && (APPLICATION_STATUSES as readonly string[]).includes(value);
}

export function canTransitionApplication(from: string, to: string): boolean {
  if (!isApplicationStatus(from) || !isApplicationStatus(to)) return false;
  return from === to || APPLICATION_STATUS_TRANSITIONS[from].includes(to);
}

/** The current status plus every status it may move to, in workflow order. */
export function statusOptionsFrom(current: string): ApplicationStatusValue[] {
  if (!isApplicationStatus(current)) return [...APPLICATION_STATUSES];
  const allowed = new Set<ApplicationStatusValue>([current, ...APPLICATION_STATUS_TRANSITIONS[current]]);
  return APPLICATION_STATUSES.filter((s) => allowed.has(s));
}
