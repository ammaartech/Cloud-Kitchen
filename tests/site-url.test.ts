import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSiteUrl } from '@/lib/site-url';

/**
 * The fallback chain behind every absolute URL the site emits. Pure function
 * of two environment variables, so each case pins both and nothing else.
 *
 * The regression this guards: a production deployment shipped with
 * NEXT_PUBLIC_SITE_URL unset, and every canonical tag, sitemap entry and
 * share-image URL said `http://localhost:3000`.
 */
describe('resolveSiteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns the explicit site URL verbatim, ignoring VERCEL_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://infinitykitchensblr.com');
    vi.stubEnv('VERCEL_URL', 'cloudkitchen-abc123.vercel.app');
    expect(resolveSiteUrl()).toBe('https://infinitykitchensblr.com');
  });

  it('derives https://<VERCEL_URL> when the explicit value is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined);
    vi.stubEnv('VERCEL_URL', 'cloudkitchen-abc123.vercel.app');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveSiteUrl()).toBe('https://cloudkitchen-abc123.vercel.app');
    // The fallback is a misconfiguration worth a line in the deploy logs.
    expect(warn).toHaveBeenCalledOnce();
  });

  it('treats a blank explicit value as unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('VERCEL_URL', 'cloudkitchen-abc123.vercel.app');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveSiteUrl()).toBe('https://cloudkitchen-abc123.vercel.app');
  });

  it('falls back to localhost only when neither variable exists', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined);
    vi.stubEnv('VERCEL_URL', undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveSiteUrl()).toBe('http://localhost:3000');
    // Local development is not a misconfiguration; no warning.
    expect(warn).not.toHaveBeenCalled();
  });
});
