/**
 * IST-today as YYYY-MM-DD.
 *
 * The business timezone is Asia/Kolkata (PRD 10). Lives in a plain module --
 * not a `'use client'` one -- so it can be called from both server components
 * and client components without Next's boundary checker mistaking it for a
 * client reference.
 */
export function todayISO(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${ist.getFullYear()}-${pad(ist.getMonth() + 1)}-${pad(ist.getDate())}`;
}
