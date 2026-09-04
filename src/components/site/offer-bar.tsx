import Link from 'next/link';
import { listPublicOffers } from '@/lib/data/catalog';
import { headlineOffer, offerLabel } from '@/lib/offers';

/**
 * The strip above the header: what is running, and the code that gets it.
 *
 * It is the top line of the page, so it earns that place by being the one thing
 * on the site with a deadline attached. Everything else here is a description of
 * a service; this is the only line that is worth less tomorrow.
 *
 * ## It is read from the database, not written here
 *
 * The obvious version of this component has the discount and the code typed
 * into it. That version is wrong within a week: the kitchen changes an offer in
 * the admin, every surface that reads the table updates, and the strip across
 * the top of every page goes on advertising a code that no longer exists --
 * loudly, permanently, and in the one place nobody thinks to look when the
 * complaints start. It shares `headlineOffer` with the hero's gateway pill, so
 * the two cannot disagree about which offer is the headline one.
 *
 * When there is no offer, there is no strip. Not an empty bar, not a placeholder
 * -- the component returns null and the header sits at the top of the page the
 * way it did before. A promotional bar with nothing to promote is a permanent
 * 40px tax on every screen.
 *
 * ## Why it does not stick
 *
 * The header does; this does not. It is an announcement, and an announcement is
 * something you read once -- pinning it to the top of the viewport spends a
 * band of every screen, forever, on a sentence the visitor finished with on the
 * first scroll. It leaves with the rest of the page and the header takes over
 * the top edge, which is the arrangement every site that has thought about this
 * arrives at.
 *
 * ## Why the whole strip is the link
 *
 * The code is the useful part and it is also small text on a coloured ground.
 * Making the bar itself the target means the hit area is the full width of the
 * viewport rather than six characters, which matters most on the device where
 * the text is smallest.
 */
export async function OfferBar() {
  const offers = await listPublicOffers();
  const offer = headlineOffer(offers);
  const label = offer ? offerLabel(offer) : null;

  if (!offer || !label) return null;

  return (
    <Link href="/offers" className="offer-bar">
      <span className="offer-bar-text">
        {/* The code first, because it is the part that has to be remembered and
            the part that is copied out. The discount is the reason to care and
            comes second -- it is already implied by there being a bar at all. */}
        Use code <span className="offer-bar-code">{offer.code}</span>
        <span className="offer-bar-sep" aria-hidden>
          {' '}
          &mdash;{' '}
        </span>
        {label} on your first plan
      </span>
    </Link>
  );
}
