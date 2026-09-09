import type { ReactNode } from 'react';
import { cx } from '@/components/ui/button-styles';

/**
 * Everything that knows the kitchen's WhatsApp line.
 *
 * This whole folder is temporary -- it exists because the poster went out
 * before the storefront did, and ordering has to land somewhere in the
 * meantime. Keeping the number, the copy and the button in the route folder
 * rather than in `components/` means retiring it is `rm -r src/app/whatsapp`,
 * with nothing left behind in the shared layer to go stale.
 */

/**
 * Digits only, country code first. `wa.me` will not accept a `+`, spaces or
 * dashes -- it answers those with "phone number shared via url is invalid",
 * which looks like a broken link rather than a formatting mistake, so the
 * pretty form is kept separately below for display.
 */
const WHATSAPP_NUMBER = '919880370731';

/** The same number as a human reads it. Shown so it can be saved to contacts. */
export const WHATSAPP_DISPLAY = '+91 98803 70731';

/** What the poster promises, so this is what the composer has to open with. */
export const DEFAULT_MESSAGE = "Hi I'm interested in your meal plans! Give me details!";

/**
 * Opens WhatsApp with the message already typed.
 *
 * `wa.me` rather than `api.whatsapp.com`: it is the link WhatsApp documents for
 * exactly this, and it resolves to the installed app on a phone and to WhatsApp
 * Web on a desktop without the page having to detect which it is dealing with.
 */
export function whatsappLink(message: string = DEFAULT_MESSAGE): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** The WhatsApp glyph, so the button is recognisable before the label is read. */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cx('shrink-0', className)}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

type Size = 'sm' | 'md' | 'lg';
type Tone = 'brand' | 'outline';

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm gap-2',
  md: 'h-11 px-5 text-sm gap-2',
  // Thumb-sized. This page is read on a phone held one-handed, having been
  // typed in from a printed poster, and the tap is the only thing on it that
  // matters.
  lg: 'h-14 px-8 text-base gap-2.5',
};

const GLYPH_SIZES: Record<Size, string> = {
  sm: 'size-4',
  md: 'size-[18px]',
  lg: 'size-5',
};

/**
 * WhatsApp's own green, and ink rather than white on top of it.
 *
 * The green is not negotiable -- it is the whole reason the button is
 * recognised as a chat and not as a form submit -- but WhatsApp's own white
 * label sits at 2.1:1 on it and is unreadable by any standard this codebase
 * holds itself to. Ink on the same green is 9.2:1, so the colour survives and
 * the label is legible. It is written as literals rather than tokens because
 * the palette is deliberately one hue and this is not part of it; a
 * `--ck-whatsapp` in `globals.css` would outlive this folder.
 */
const TONES: Record<Tone, string> = {
  brand: 'bg-[#25d366] text-[#0d1714] hover:bg-[#1fbb59] active:bg-[#1aa54e] shadow-ck',
  outline: 'border border-line-strong bg-surface text-ink hover:bg-sunken active:bg-sunken',
};

/**
 * A real `<a>`, and deliberately not a client component: the entire page is
 * static HTML and a link that leaves the site needs no JavaScript to work.
 *
 * `target="_blank"` with `rel="noopener"` -- on a phone this hands off to the
 * WhatsApp app and the menu is still open in the browser behind it, which is
 * what someone reading a menu and asking a question about it actually wants.
 */
export function WhatsAppButton({
  message,
  size = 'md',
  tone = 'brand',
  className,
  children,
}: {
  message?: string;
  size?: Size;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={whatsappLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        'inline-flex items-center justify-center rounded-ck-sm font-semibold',
        'transition-[background-color,transform] duration-150 ease-ck active:scale-[0.97]',
        SIZES[size],
        TONES[tone],
        className,
      )}
    >
      <WhatsAppGlyph className={GLYPH_SIZES[size]} />
      {children}
    </a>
  );
}
