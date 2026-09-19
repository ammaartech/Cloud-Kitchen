import { describe, expect, it } from 'vitest';
import {
  hasPreviewAccess,
  isOpenWhileLocked,
  parseEmailList,
  PREVIEW_TESTERS,
} from '@/lib/auth/site-lock';

describe('the built-in testers', () => {
  it('are all well-formed, so none is silently dropped by the parser', () => {
    expect(parseEmailList(PREVIEW_TESTERS.join(',')).size).toBe(PREVIEW_TESTERS.length);
  });

  it('get in as customers', () => {
    const testers = parseEmailList(PREVIEW_TESTERS.join(','));
    for (const email of PREVIEW_TESTERS) {
      expect(hasPreviewAccess(email, { role: 'customer', isActive: true }, testers)).toBe(true);
    }
  });
});

const allowed = parseEmailList('owner@cloudkitchen.test, Meera@Example.test\nrahul@example.test');

describe('the allow-list', () => {
  it('reads comma- and newline-separated addresses, case-insensitively', () => {
    expect([...allowed].sort()).toEqual([
      'meera@example.test',
      'owner@cloudkitchen.test',
      'rahul@example.test',
    ]);
  });

  it('is empty when unset', () => {
    expect(parseEmailList(undefined).size).toBe(0);
    expect(parseEmailList('').size).toBe(0);
  });

  it('refuses domain wildcards and junk rather than half-matching them', () => {
    expect(parseEmailList('@cloudkitchen.test, *@example.test, not-an-email').size).toBe(0);
  });
});

describe('who gets past the lock', () => {
  const active = (role: string) => ({ role, isActive: true });

  it('lets a Developer Admin in whatever their email', () => {
    expect(hasPreviewAccess('someone@gmail.com', active('developer_admin'), allowed)).toBe(true);
    expect(hasPreviewAccess(undefined, active('developer_admin'), allowed)).toBe(true);
  });

  it('lets a listed test account in, whatever its role', () => {
    expect(hasPreviewAccess('owner@cloudkitchen.test', active('owner'), allowed)).toBe(true);
    expect(hasPreviewAccess('MEERA@example.test', active('customer'), allowed)).toBe(true);
  });

  it('keeps out an account that is neither', () => {
    expect(hasPreviewAccess('stranger@gmail.com', active('customer'), allowed)).toBe(false);
    // Owner is a powerful role, but it is not the developer role.
    expect(hasPreviewAccess('boss@gmail.com', active('owner'), allowed)).toBe(false);
    expect(hasPreviewAccess(undefined, active('customer'), allowed)).toBe(false);
  });

  it('keeps out a deactivated account, even a listed or developer one', () => {
    expect(hasPreviewAccess('owner@cloudkitchen.test', { role: 'owner', isActive: false }, allowed)).toBe(false);
    expect(hasPreviewAccess('x@y.z', { role: 'developer_admin', isActive: false }, allowed)).toBe(false);
  });

  it('keeps out an account with no profile', () => {
    expect(hasPreviewAccess('owner@cloudkitchen.test', null, allowed)).toBe(false);
  });
});

describe('what stays open while locked', () => {
  it.each([
    '/sign-in',
    '/private-preview',
    '/robots.txt',
    '/api/auth/sign-out',
    '/api/account/session',
    '/api/jobs/release-deliveries',
    '/api/payments/razorpay/webhook',
    '/api/marketplace/swiggy/webhook',
  ])('%s', (path) => {
    expect(isOpenWhileLocked(path)).toBe(true);
  });

  it.each([
    '/',
    '/menu',
    '/about',
    '/account',
    '/checkout',
    '/admin',
    '/kot/manager',
    '/whatsapp',
    '/sitemap.xml',
    '/sign-inx',
    '/api/checkout/begin',
    '/api/checkout/sandbox',
    '/api/dev/generate-test-order',
    '/api/kot/transition',
    '/api/payments/razorpay/webhook/extra',
    '/api/payments/webhook',
  ])('%s is locked', (path) => {
    expect(isOpenWhileLocked(path)).toBe(false);
  });
});
