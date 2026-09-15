/**
 * Which image URLs the optimizer will accept.
 *
 * Mirrors `images.remotePatterns` in `next.config.ts`. `next/image` throws at
 * render for a host it has not been told about -- the correct behaviour for a
 * hardcoded asset, and the wrong one for a URL an Owner pasted into a form
 * five seconds ago, which took the whole product editor down with it. The
 * editor checks here first and renders an unknown host unoptimised instead.
 *
 * Keep the two lists in step. This one is deliberately conservative: a URL it
 * misjudges as unoptimisable is merely served as-is, whereas the reverse
 * would reintroduce the crash.
 */
const OPTIMISABLE = [
  { host: /^images\.unsplash\.com$/, path: /^\// },
  { host: /^[a-z0-9-]+\.supabase\.co$/, path: /^\/storage\/v1\/object\/public\// },
] as const;

export function isOptimisableImage(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Relative paths point at our own `public/` folder, which is always fine.
    return url.startsWith('/') && !url.startsWith('//');
  }

  if (parsed.protocol !== 'https:') return false;

  return OPTIMISABLE.some(
    (rule) => rule.host.test(parsed.hostname) && rule.path.test(parsed.pathname),
  );
}
