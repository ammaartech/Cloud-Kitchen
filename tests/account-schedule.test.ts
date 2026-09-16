import { describe, expect, it } from 'vitest';
import {
  buildSchedule,
  cycleProgress,
  daysInclusive,
  kitchenStep,
  lockInstant,
  pauseImpact,
  relativeDay,
  skipDeadline,
  type UpcomingDelivery,
} from '@/lib/account/schedule';

/**
 * The account overview's calendar arithmetic. Pure functions, so no database:
 * every case pins "today" and "now", which is the point -- the page and these
 * tests read the same answers at the same moment.
 */

const TODAY = '2026-09-16'; // a Wednesday

function delivery(overrides: Partial<UpcomingDelivery>): UpcomingDelivery {
  return {
    id: 'd',
    date: TODAY,
    status: 'scheduled',
    windowLabel: 'Lunch',
    windowStartsAt: '12:30:00',
    creditsCost: 1,
    items: [],
    kitchenStatus: null,
    ticketCode: null,
    prepEtaMinutes: null,
    locksAt: null,
    ...overrides,
  };
}

describe('lockInstant', () => {
  it('is the window opening on the kitchen clock, less the release lead time', () => {
    // 12:30 IST is 07:00 UTC; two hours earlier is 05:00 UTC.
    expect(lockInstant('2026-09-17', '12:30:00', 120)).toBe('2026-09-17T05:00:00.000Z');
  });

  it('crosses midnight backwards when the lead is longer than the morning', () => {
    expect(lockInstant('2026-09-17', '01:00:00', 120)).toBe('2026-09-16T17:30:00.000Z');
  });
});

describe('skipDeadline', () => {
  const now = new Date('2026-09-16T03:00:00Z'); // 08:30 IST

  it('says today when the lock is later today', () => {
    expect(skipDeadline('2026-09-16T05:00:00.000Z', now, TODAY)).toBe('until 10:30 am today');
  });

  it('says tomorrow when the lock is tomorrow', () => {
    expect(skipDeadline('2026-09-17T05:00:00.000Z', now, TODAY)).toBe('until 10:30 am tomorrow');
  });

  it('names the date further out', () => {
    expect(skipDeadline('2026-09-19T05:00:00.000Z', now, TODAY)).toMatch(/^until 10:30 am, Sat/);
  });

  it('offers nothing once the lock has passed, so the page never offers a refused skip', () => {
    expect(skipDeadline('2026-09-16T02:59:00.000Z', now, TODAY)).toBeNull();
    expect(skipDeadline(null, now, TODAY)).toBeNull();
  });
});

describe('relativeDay', () => {
  it('uses words only where they cannot be misread', () => {
    expect(relativeDay(TODAY, TODAY)).toBe('Today');
    expect(relativeDay('2026-09-17', TODAY)).toBe('Tomorrow');
    expect(relativeDay('2026-09-18', TODAY)).toMatch(/^Fri/);
  });
});

describe('buildSchedule', () => {
  const days = buildSchedule({
    today: TODAY,
    span: 7,
    cycleEnd: '2026-09-20',
    pauses: [{ startsOn: '2026-09-19', endsOn: '2026-09-20' }],
    deliveries: [
      delivery({ id: 'a', date: '2026-09-16', status: 'released' }),
      delivery({ id: 'b', date: '2026-09-17' }),
      delivery({ id: 'c', date: '2026-09-18', status: 'skipped' }),
      delivery({ id: 'd', date: '2026-09-19', status: 'skipped' }),
    ],
  });

  it('covers the span from today, with weekday names', () => {
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ date: TODAY, weekday: 'Wed', dayOfMonth: 16, isToday: true });
    expect(days[6].date).toBe('2026-09-22');
  });

  it('classifies each day by what the customer most needs to know', () => {
    expect(days.map((day) => day.kind)).toEqual([
      'kitchen',
      'delivery',
      'skipped',
      // Skipped by the pause: shown as the pause, which is what was done.
      'paused',
      'paused',
      'rest',
      'rest',
    ]);
  });

  it('only lists deliveries that are still coming', () => {
    expect(days[1].deliveryIds).toEqual(['b']);
    expect(days[2].deliveryIds).toEqual([]);
  });

  it('marks the last day of the cycle', () => {
    expect(days.filter((day) => day.isCycleEnd).map((day) => day.date)).toEqual(['2026-09-20']);
  });
});

describe('pauseImpact', () => {
  const upcoming = [
    delivery({ id: 'a', date: '2026-09-17', creditsCost: 1 }),
    delivery({ id: 'b', date: '2026-09-18', creditsCost: 2 }),
    delivery({ id: 'c', date: '2026-09-19', status: 'skipped' }),
    delivery({ id: 'd', date: '2026-09-21', creditsCost: 1 }),
  ];

  it('counts only scheduled deliveries inside the range', () => {
    expect(pauseImpact(upcoming, '2026-09-17', '2026-09-19', true)).toEqual({
      skipped: 2,
      credits: 3,
      resumesOn: '2026-09-21',
    });
  });

  it('returns no credits where skips do not return them', () => {
    expect(pauseImpact(upcoming, '2026-09-17', '2026-09-18', false).credits).toBe(0);
  });

  it('has no resume date when nothing is scheduled after the pause', () => {
    expect(pauseImpact(upcoming, '2026-09-17', '2026-09-30', true).resumesOn).toBeNull();
  });
});

describe('cycleProgress', () => {
  it('reads elapsed and remaining days, counting both ends of the cycle', () => {
    expect(daysInclusive('2026-09-01', '2026-09-30')).toBe(30);
    expect(cycleProgress('2026-09-01', '2026-09-30', TODAY)).toEqual({
      ratio: 15 / 30,
      daysLeft: 15,
      totalDays: 30,
    });
  });

  it('clamps outside the cycle', () => {
    expect(cycleProgress('2026-09-20', '2026-09-30', TODAY)?.ratio).toBe(0);
    expect(cycleProgress('2026-08-01', '2026-08-30', TODAY)).toMatchObject({ ratio: 1, daysLeft: 0 });
  });

  it('has nothing to say without both dates', () => {
    expect(cycleProgress(null, '2026-09-30', TODAY)).toBeNull();
  });
});

describe('kitchenStep', () => {
  it('folds the KOT states into five steps a customer recognises', () => {
    expect(['NEW', 'PREPARING', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].map(kitchenStep)).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(kitchenStep('REJECTED')).toBeNull();
  });
});
