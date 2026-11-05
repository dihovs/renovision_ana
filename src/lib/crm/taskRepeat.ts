/** Task repeat rules (migration 0057) — pure, so the task list (a client
    component) can show them. */

export const REPEAT_RULES = ["none", "daily", "weekly", "monthly"] as const;
export type RepeatRule = (typeof REPEAT_RULES)[number];
export const REPEAT_LABEL: Record<RepeatRule, string> = {
  none: "Once",
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
};

/**
 * When the next copy of a repeating task is due: one period after its own
 * due date, or after today when it had none. Dates are plain "YYYY-MM-DD"
 * and worked at noon UTC so no zone moves them. A monthly task due on the
 * 31st lands on the last day of a shorter month.
 */
export function nextDueDate(due: string | null, rule: RepeatRule, today: string): string | null {
  if (rule === "none") return null;
  const base = new Date(`${due ?? today}T12:00:00Z`);
  if (rule === "daily") base.setUTCDate(base.getUTCDate() + 1);
  else if (rule === "weekly") base.setUTCDate(base.getUTCDate() + 7);
  else {
    const day = base.getUTCDate();
    base.setUTCDate(1);
    base.setUTCMonth(base.getUTCMonth() + 1);
    const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    base.setUTCDate(Math.min(day, last));
  }
  return base.toISOString().slice(0, 10);
}
