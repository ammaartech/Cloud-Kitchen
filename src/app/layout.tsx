import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

/**
 * Type.
 *
 * One family carries the whole system -- storefront, admin and the kitchen
 * display. Inter has the highest x-height and the most open apertures of the
 * faces considered, which is what the KOT screen needs when it is read at
 * arm's length under bad lighting (PRD 19), and it has true tabular figures
 * for the money and ticket columns.
 *
 * `latin-ext` is not optional. The rupee sign (U+20B9) lives in that subset,
 * not in `latin`, so loading `latin` alone leaves every price on the site
 * falling back to whatever the operating system happens to have.
 */
const sans = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

/**
 * The two faces the plan notes are set in, and the only two places on the site
 * where Inter is not the answer.
 *
 * The system is deliberately one family -- it is product UI, and a second face
 * in an admin table is decoration with a download attached. The notes are the
 * exception because they are pretending to be a different object: a piece of
 * paper someone wrote on, sitting on a page made of interface. Type is most of
 * what sells that, and Inter cannot do it, because Inter is what the interface
 * around them is already set in.
 *
 * They pair on the contrast axis rather than by similarity -- Zodiak is a
 * serif and Cabinet Grotesk is a grotesque sans, so each is unmistakably not
 * the other. Two sans faces this close in feel would just read as a mistake.
 *
 * One variable file each, ~40 KB, covering the whole 100-900 weight range,
 * rather than a static file per weight.
 *
 * `preload: false` on both. They are used by one section of one route, below
 * the fold; preloading would put two font files on the critical path of every
 * page in the app -- including the KOT screens -- to style four notes on the
 * home page. `display: 'swap'` means the notes render in the fallback and
 * reflow when the face lands, which is the correct trade for something nobody
 * has scrolled to yet.
 */
const noteDisplay = localFont({
  src: './fonts/Zodiak-Variable.woff2',
  variable: '--font-zodiak',
  weight: '100 900',
  display: 'swap',
  preload: false,
  // Georgia rather than the generic `serif`: it is on effectively every
  // machine, and its proportions are close enough to Zodiak's that the swap
  // does not visibly reflow the note.
  fallback: ['Georgia', 'serif'],
});

const noteText = localFont({
  src: './fonts/CabinetGrotesk-Variable.woff2',
  variable: '--font-cabinet',
  weight: '100 900',
  display: 'swap',
  preload: false,
  fallback: ['system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: {
    default: 'Cloud Kitchen',
    template: '%s · Cloud Kitchen',
  },
  description:
    'Home-style meals on subscription, cooked fresh each day in a single kitchen.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${noteDisplay.variable} ${noteText.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-ink">{children}</body>
    </html>
  );
}
