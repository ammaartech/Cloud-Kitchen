/**
 * How many characters `Typewriter` will actually type, which is not
 * `text.length`.
 *
 * Spaces are rendered as plain text between the word spans and never get a slot
 * of their own, so the string's length overstates the run by one per word.
 *
 * It lives in its own module, with no `'use client'` on it, and that is the
 * whole reason the file exists. `Typewriter` is a client component, and a
 * function exported from a client module cannot be *called* on the server --
 * only rendered or passed as a prop. The one caller that needs this is the
 * storefront layout, which is a server component chaining three of them and has
 * to know how long each runs. Splitting the arithmetic out is what lets both
 * sides use the same definition instead of the server keeping its own copy that
 * can silently drift from the one doing the work.
 */
export function typedLengthOf(text: string): number {
  return text.split(' ').reduce((total, word) => total + word.length, 0);
}
