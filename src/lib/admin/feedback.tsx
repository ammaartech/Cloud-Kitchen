import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Alert } from '@/components/ui/primitives';

/**
 * Feedback for server actions on the admin screens.
 *
 * A server action cannot return a value to a server-rendered page, so the
 * outcome travels back in the query string and the page renders it. That
 * matters more here than it looks: a create form that silently does nothing
 * when the database rejects it is how an Owner ends up believing a plan exists
 * when it does not.
 */
/**
 * Typed routes cover the path but not the query string it carries, so the cast
 * is on the assembled URL only -- `path` itself still comes from a literal at
 * every call site.
 */
export function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}` as Route);
}

export function done(path: string, message: string): never {
  redirect(`${path}?ok=${encodeURIComponent(message)}` as Route);
}

/** Postgres errors are precise but not phrased for a person. */
export function readable(error: { message: string; code?: string } | null): string {
  if (!error) return 'Something went wrong.';

  if (error.code === '23505') return 'That already exists — pick a different code or slug.';
  if (error.code === '23503') {
    return 'Something else still references this record, so it cannot be removed. Hide it instead.';
  }
  if (error.code === '23514') return 'That combination of values is not allowed.';
  if (error.code === '42501') return 'You do not have permission to do that.';

  return error.message;
}

export function ActionFeedback({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;

  return (
    <div className="mb-6">
      <Alert tone={error ? 'danger' : 'success'}>{error ?? ok}</Alert>
    </div>
  );
}
