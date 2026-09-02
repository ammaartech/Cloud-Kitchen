/**
 * FormData readers for the admin and account screens.
 *
 * A server action receives everything as a string, so the job here is to turn
 * that back into the shape each column actually expects. The important part is
 * the distinction between a *cleared* field and a *zero* one: writing '' into a
 * nullable numeric column is an error, not a null, and writing 0 where the
 * Owner meant "no override" silently changes policy.
 */

export function str(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

export function num(form: FormData, key: string, fallback = 0): number {
  const value = Number(str(form, key));
  return Number.isFinite(value) ? value : fallback;
}

export function nullableNum(form: FormData, key: string): number | null {
  const raw = str(form, key);
  if (raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** An unchecked checkbox is absent from FormData entirely, hence the default. */
export function bool(form: FormData, key: string): boolean {
  const value = form.get(key);
  return value === 'true' || value === 'on' || value === '1';
}

/**
 * Tri-state. A plan-level rule left blank means "use the global setting", and
 * that is a genuinely different answer from "false" -- the default has to keep
 * living in exactly one place (PRD 20).
 */
export function nullableBool(form: FormData, key: string): boolean | null {
  const raw = str(form, key);
  if (raw === '') return null;
  return raw === 'true';
}

export function list(form: FormData, key: string): string[] {
  return form
    .getAll(key)
    .map((value) => String(value).trim())
    .filter((value) => value !== '');
}

/**
 * Derives a URL-safe slug from a name so the create forms do not make the
 * Owner invent one. Slugs stay editable afterwards -- this is a starting
 * point, not a rule.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Uppercase, punctuation-free code for coupons, variant groups and add-ons. */
export function codify(input: string): string {
  return input
    .toUpperCase()
    .normalize('NFKD')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}
