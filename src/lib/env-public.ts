/**
 * The public environment: what the browser is allowed to know.
 *
 * Its own module, and free of every import but one, because the browser
 * Supabase client reads it. It used to live in `env.ts` beside the server
 * schema, and a module is imported whole: reaching for these three strings
 * from a client component shipped Zod -- and built the entire server schema at
 * load time -- in the bundle of every page that can sign somebody in or out.
 * The one import, `resolveSiteUrl`, has no dependencies of its own, so the
 * bundle stays exactly as small.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so there is nothing here to
 * validate in the browser. `serverEnv()` still checks the two Supabase values
 * on the server, where a missing one is a readable boot error rather than a
 * blank page.
 */
import { resolveSiteUrl } from './site-url';

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  // Never a bare `localhost` on a real deployment; see `site-url.ts`.
  siteUrl: resolveSiteUrl(),
};
