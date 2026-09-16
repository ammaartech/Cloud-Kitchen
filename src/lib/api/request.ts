import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';

/**
 * Reads and validates a JSON request body.
 *
 * `await request.json()` throws on a body that is not JSON, and an uncaught
 * throw in a route handler is a 500 with a stack trace in the log for what is
 * a caller's mistake. Every JSON endpoint reads through this instead, so a
 * malformed body is a 400 that says so, and a body that parses but fails its
 * schema gets the same answer. Neither response echoes the input: what was
 * sent is the caller's to know, not something to reflect back.
 */
export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

const INVALID = 'That request was not valid';

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<ParsedBody<T>> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: INVALID }, { status: 400 }) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: NextResponse.json({ error: INVALID }, { status: 400 }) };
  }

  return { ok: true, data: parsed.data };
}
