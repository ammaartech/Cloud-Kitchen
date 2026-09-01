import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
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
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-ink">{children}</body>
    </html>
  );
}
