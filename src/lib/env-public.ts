/**
 * The public environment: what the browser is allowed to know.
 *
 * Its own module, and deliberately free of imports, because the browser
 * Supabase client reads it. It used to live in `env.ts` beside the server
 * schema, and a module is imported whole: reaching for these three strings
 * from a client component shipped Zod -- and built the entire server schema at
 * load time -- in the bundle of every page that can sign somebody in or out.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so there is nothing here to
 * validate in the browser. `serverEnv()` still checks the two Supabase values
 * on the server, where a missing one is a readable boot error rather than a
 * blank page.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
};
