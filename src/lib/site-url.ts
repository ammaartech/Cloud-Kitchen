/**
 * The public site URL: what canonical tags, the sitemap, the share image,
 * JSON-LD and Cashfree's return and notify URLs are built on.
 *
 * Shared by `env-public.ts` (server and browser bundle) and `env.ts` (server
 * only, as the Zod default) so the fallback chain cannot drift between the
 * two. This file imports nothing -- no Zod, no `env.ts` -- so pulling it into
 * `env-public.ts` does not drag the server schema into the browser bundle the
 * way importing the rest of `env.ts` would.
 *
 * Order:
 *   1. NEXT_PUBLIC_SITE_URL, when set and non-blank. The intended answer, and
 *      in production the real https:// custom domain.
 *   2. `https://${VERCEL_URL}`. Vercel sets VERCEL_URL on every Production and
 *      Preview build without configuration -- the deployment's own hostname,
 *      no protocol, no trailing slash. This is what stops a deployment that
 *      forgot the variable from ever serving `localhost` again: it resolves
 *      to its own working `*.vercel.app` address instead. (Requires
 *      "Automatically expose System Environment Variables" in the Vercel
 *      project settings, which is on by default.)
 *   3. `http://localhost:3000` for `next dev` and the test suite, where neither
 *      variable exists.
 *
 * No branch on VERCEL_ENV or NODE_ENV. VERCEL_URL is present on both Production
 * and Preview, so VERCEL_ENV would never change which branch runs; and NODE_ENV
 * is 'production' on every Vercel deployment (see SHOW_DEMO_ACCOUNTS in
 * `env.ts`), so it cannot tell a real deploy from a local build.
 *
 * A fallback rather than a thrown error, deliberately. `serverEnv()` is not
 * only called at build time: `CashfreeAdapter` calls it lazily on the first
 * checkout or webhook request, and a throw there would take payments down over
 * a missing variable. A wrong-but-reachable URL is the smaller failure.
 */
export function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit;

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    // Once or twice per process, in the Vercel build and function logs. A
    // deployment with no explicit site URL is worth surfacing there even
    // though it is not worth failing over.
    console.warn(
      `[env] NEXT_PUBLIC_SITE_URL is not set; falling back to https://${vercelUrl}. ` +
        'Set it in Vercel -> Settings -> Environment Variables to the real domain and ' +
        'redeploy: NEXT_PUBLIC_ values are inlined at build time, so saving the ' +
        'variable alone does not change an existing deployment.',
    );
    return `https://${vercelUrl}`;
  }

  return 'http://localhost:3000';
}
