/**
 * The three public ways to reach the kitchen.
 *
 * One place, because the footer is not the only thing that needs them: the
 * poster page already hardcodes the WhatsApp number in `whatsapp/chat.tsx`, and
 * the privacy and terms pages both print it in their contact sections. A phone
 * number that has to be changed in four files is a phone number that will end
 * up being three different numbers.
 *
 * `whatsappHref` is a bare `wa.me` link rather than the prefilled one the
 * poster page builds. That page opens WhatsApp with an order message already
 * written because the visitor arrived intending to order; somebody who scrolled
 * to the footer may be writing about anything, and a prefilled "I'd like to
 * order" is a message they then have to delete.
 *
 * TODO(ops): `instagramHandle` and `email` are placeholders and are on screen
 * as such. Swap them for the real handle and inbox before this goes out --
 * `mailto:` on an address nobody reads is worse than no address at all.
 */
export const CONTACT = {
  /** Digits only, in the form `wa.me` wants: country code, no + and no spaces. */
  whatsappNumber: '919880370731',
  whatsappDisplay: '+91 98803 70731',
  whatsappHref: 'https://wa.me/919880370731',
  instagramHandle: '@example',
  instagramHref: 'https://instagram.com/example',
  email: 'hello@example.com',
} as const;
