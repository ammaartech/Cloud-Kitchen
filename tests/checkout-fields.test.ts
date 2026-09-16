import { describe, expect, it } from 'vitest';
import {
  addDays,
  businessDate,
  calendarDate,
  dayOfWeek,
  firstDeliveryDate,
  subscriptionStartDate,
} from '../src/lib/checkout/schedule';
import {
  checkDelivery,
  checkField,
  nationalMobile,
  storedMobile,
} from '../src/lib/checkout/fields';

/**
 * Pure functions, so no database: these are the two pieces of checkout logic
 * that run in the browser as well as on the server, and both make a promise to
 * the customer -- a delivery date, and what counts as a deliverable address.
 */

describe('delivery schedule', () => {
  it('reads the business date in India, not in UTC', () => {
    // 20:00 UTC on the 16th is 01:30 on the 17th in Kolkata.
    expect(businessDate(new Date('2026-09-16T20:00:00Z'))).toBe('2026-09-17');
    expect(businessDate(new Date('2026-09-16T18:00:00Z'))).toBe('2026-09-16');
  });

  it('starts the day after checkout, as begin_subscription_checkout does', () => {
    expect(subscriptionStartDate(new Date('2026-09-16T06:00:00Z'))).toBe('2026-09-17');
  });

  it('delivers on the start date when every day is chosen', () => {
    expect(firstDeliveryDate([], new Date('2026-09-16T06:00:00Z'))).toBe('2026-09-17');
  });

  it('skips forward to the first chosen day', () => {
    // Friday the 18th in India, so the subscription starts on Saturday the 19th
    // and a weekday plan first delivers on Monday the 21st.
    const now = new Date('2026-09-18T06:00:00Z');
    expect(dayOfWeek(subscriptionStartDate(now))).toBe(6);
    expect(firstDeliveryDate([1, 2, 3, 4, 5], now)).toBe('2026-09-21');
    expect(firstDeliveryDate([6], now)).toBe('2026-09-19');
    expect(firstDeliveryDate([0], now)).toBe('2026-09-20');
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('formats a date without a timezone moving it', () => {
    const label = calendarDate('2026-09-21');
    expect(label).toContain('Mon');
    expect(label).toContain('21');
  });
});

describe('delivery form rules', () => {
  it('reads a mobile number however it was typed', () => {
    expect(nationalMobile('+91 98100 00001')).toBe('9810000001');
    expect(nationalMobile('098100 00001')).toBe('9810000001');
    expect(storedMobile('98100-00001')).toBe('+919810000001');
  });

  it('says exactly what is wrong with a mobile number', () => {
    expect(checkField('phone', '98100')).toBe('Mobile numbers are 10 digits. This one has 5.');
    expect(checkField('phone', '5810000001')).toBe(
      'Indian mobile numbers start with 6, 7, 8 or 9.',
    );
    expect(checkField('phone', '98100abc01')).toBe('Use digits only in the mobile number.');
    expect(checkField('phone', '+91 98100 00001')).toBeNull();
  });

  it('says exactly what is wrong with a PIN code', () => {
    expect(checkField('postalCode', '56001')).toBe('PIN codes are 6 digits. This one has 5.');
    expect(checkField('postalCode', '056001')).toBe('PIN codes never start with 0.');
    expect(checkField('postalCode', '56OO01')).toBe('PIN codes are numbers only.');
    expect(checkField('postalCode', '560 001')).toBeNull();
  });

  it('only accepts a real state', () => {
    expect(checkField('state', 'Karnataka')).toBeNull();
    expect(checkField('state', 'Bangalore')).toBe('Choose a state from the list.');
  });

  it('treats the optional fields as optional', () => {
    const errors = checkDelivery({
      fullName: 'Meera Iyer',
      phone: '9810000001',
      line1: '402, Lotus Residency',
      postalCode: '400705',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
    });
    expect(errors).toEqual({});
  });

  it('reports every missing required field at once', () => {
    expect(Object.keys(checkDelivery({})).sort()).toEqual(
      ['city', 'fullName', 'line1', 'phone', 'postalCode', 'state'].sort(),
    );
  });
});
