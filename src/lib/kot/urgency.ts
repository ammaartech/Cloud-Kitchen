import type { BoardTicket } from '@/lib/realtime/kot-board-shared';

/**
 * The board's ordering, computed where the board is.
 *
 * `v_kot_tickets` reports an `urgency_score` -- 0 with no deadline, 1000 once
 * the deadline has passed, and a ramp over the last ten minutes before it --
 * but the view computes it at read time. A live board is read once and then
 * kept current by change events, so between events the score in memory ages:
 * a ticket that crossed its deadline three minutes ago still sorts as though
 * it had two minutes left, until something else on the board happens to
 * change. The same formula here, fed the clock the screen ticks on, keeps the
 * order true without another read. It mirrors migration 0015 exactly,
 * integer division included, so the server's number and this one never
 * disagree for the same instant.
 */
export function urgencyScore(slaDueAt: string | null | undefined, now = Date.now()): number {
  if (!slaDueAt) return 0;

  const due = new Date(slaDueAt).getTime();
  if (Number.isNaN(due)) return 0;
  if (due <= now) return 1000;

  // `extract(epoch ...)::integer / 6`: the cast rounds, the division truncates.
  const secondsLeft = Math.round((due - now) / 1000);
  return Math.max(0, 600 - Math.trunc(secondsLeft / 6));
}

/**
 * Marketplace orders outrank scheduled deliveries by baseline priority, and
 * an approaching deadline escalates anything (PRD 9). Ties fall to arrival
 * order, oldest first, so two tickets of equal weight keep their queue.
 */
export function sortTickets<T extends BoardTicket>(tickets: Iterable<T>, now = Date.now()): T[] {
  return [...tickets].sort((a, b) => {
    const weightA = a.priority + urgencyScore(a.sla_due_at, now);
    const weightB = b.priority + urgencyScore(b.sla_due_at, now);
    if (weightA !== weightB) return weightB - weightA;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}
