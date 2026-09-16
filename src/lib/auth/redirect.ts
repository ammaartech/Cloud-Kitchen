/**
 * Keeps a post-sign-in destination on this site.
 *
 * `/sign-in?next=...` is read straight off the URL, and once the password is
 * accepted the form hands the value to `router.push`. Pushed as it arrived, a
 * value of `https://evil.example` or `//evil.example` is a full navigation off
 * the site the moment somebody signs in, which is an open redirect a phishing
 * link can ride on: the address bar shows this site, the password goes to this
 * site, and the page that follows belongs to someone else. Only a path on this
 * origin is accepted; anything else falls back to the caller's default.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null;
  if (!value.startsWith('/')) return null;
  // `//host` and `/\host` are protocol-relative URLs to a browser.
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  // Control characters have no place in a path and are how header and scheme
  // tricks are smuggled past a prefix check. Checked by code point so the
  // pattern needs no escape that a linter would flag.
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return null;
  }
  return value;
}
