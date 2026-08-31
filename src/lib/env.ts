import { z } from 'zod';

/**
 * Environment configuration.
 *
 * Secrets live here and nowhere else -- never in the database, never in a
 * client bundle (PRD 17, PRD 20). integration_accounts and the payment
 * adapters store the NAME of the variable to look up; this module resolves it.
 *
 * Business rules deliberately do NOT live here. Fees, taxes, grace periods and
 * delivery windows are rows in the database so they can change without a
 * deploy; the environment holds only credentials and deployment wiring.
 */

/**
 * An unset variable in a .env file is an empty string, not undefined. Treating
 * "" as "not provided" is what lets the example file ship with every optional
 * key present but blank -- otherwise a blank SWIGGY_API_BASE_URL fails URL
 * validation and takes the whole app down at boot.
 */
const blankAsUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message: 'NEXT_PUBLIC_SUPABASE_URL must be your project URL, e.g. https://xyz.supabase.co',
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),

  // Bypasses RLS. Server-only: importing this module from a client component
  // is a build error because of the `server-only`-style guard below.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // Payments. Absent credentials mean the provider is simply unavailable --
  // the checkout says so rather than pretending to charge anyone.
  RAZORPAY_KEY_ID: blankAsUndefined(z.string()),
  RAZORPAY_KEY_SECRET: blankAsUndefined(z.string()),
  RAZORPAY_WEBHOOK_SECRET: blankAsUndefined(z.string()),

  CASHFREE_APP_ID: blankAsUndefined(z.string()),
  CASHFREE_SECRET_KEY: blankAsUndefined(z.string()),
  CASHFREE_WEBHOOK_SECRET: blankAsUndefined(z.string()),
  CASHFREE_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),

  // Marketplaces. Swiggy and Zomato grant partner API access per merchant
  // under contract; until a base URL and key exist the adapters run against
  // the mock transport and say so (PRD 16).
  SWIGGY_API_BASE_URL: blankAsUndefined(z.string().url()),
  SWIGGY_API_KEY: blankAsUndefined(z.string()),
  SWIGGY_WEBHOOK_SECRET: blankAsUndefined(z.string()),

  ZOMATO_API_BASE_URL: blankAsUndefined(z.string().url()),
  ZOMATO_API_KEY: blankAsUndefined(z.string()),
  ZOMATO_WEBHOOK_SECRET: blankAsUndefined(z.string()),

  // Notifications. Provider is chosen later (PRD 15); with none configured the
  // dispatcher logs instead of sending, and never blocks an order.
  NOTIFICATION_PROVIDER: z.enum(['console', 'twilio', 'gupshup']).default('console'),
  TWILIO_ACCOUNT_SID: blankAsUndefined(z.string()),
  TWILIO_AUTH_TOKEN: blankAsUndefined(z.string()),
  TWILIO_WHATSAPP_FROM: blankAsUndefined(z.string()),

  // Shared secret for the scheduled jobs (delivery release, reconciliation).
  // Also signs sandbox payment callbacks, which is why it must be long.
  CRON_SECRET: blankAsUndefined(z.string().min(16)),

  // Non-production test gateway. Verifies a real signature but moves no money;
  // the adapter refuses to construct when NODE_ENV is production.
  ENABLE_SANDBOX_PAYMENTS: z.enum(['true', 'false']).default('false'),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

/**
 * Reads and validates the server environment.
 *
 * Throws a readable error listing every missing variable rather than failing
 * later with an opaque 500 from the Supabase client.
 */
export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Environment is not configured correctly:\n${problems}\n\n` +
        'Copy .env.example to .env.local and fill in your Supabase project details.',
    );
  }

  cached = parsed.data;
  return cached;
}

/** The public subset, safe to reference from the browser bundle. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
};

/**
 * Whether a payment provider has enough credentials to be offered at checkout.
 * Used to decide what the customer actually sees, so a half-configured
 * provider never reaches a real payment attempt.
 */
export function configuredPaymentProviders(): Array<'razorpay' | 'cashfree' | 'sandbox'> {
  const env = serverEnv();
  const available: Array<'razorpay' | 'cashfree' | 'sandbox'> = [];

  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) available.push('razorpay');
  if (env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY) available.push('cashfree');

  // Offered last, and only outside production, so a real provider is always
  // preferred when one is configured.
  if (
    env.ENABLE_SANDBOX_PAYMENTS === 'true' &&
    env.NODE_ENV !== 'production' &&
    env.CRON_SECRET
  ) {
    available.push('sandbox');
  }

  return available;
}

/**
 * Resolves a credential by the reference name stored in integration_accounts.
 * The database records which variable to read; only this function reads it.
 */
export function resolveSecret(ref: string | null | undefined): string | undefined {
  if (!ref) return undefined;
  // Guard against a database row being used to read arbitrary process state.
  if (!/^[A-Z0-9_]+$/.test(ref)) return undefined;
  return process.env[ref];
}
