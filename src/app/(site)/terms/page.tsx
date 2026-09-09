import Link from 'next/link';
import { LegalPage, LegalHeading } from '@/components/site/legal';

/**
 * The terms the subscription actually runs on.
 *
 * Same rule as the privacy policy: every clause here describes behaviour this
 * application really has. Prepaid cycles, skips returning to the balance, pause
 * and cancel, dishes marked unavailable with a reason rather than substituted,
 * bulk delivering city-wide while small orders stay in North Bangalore -- all
 * of it is implemented, and the sections below are a description of it rather
 * than a wish list. Changing the rules in the product means changing them here.
 *
 * TODO(ops): the registered entity name and address, the FSSAI licence number
 * and the governing jurisdiction clause need the business's real details before
 * this is relied on. They are not invented here.
 */
export const metadata = {
  title: 'Terms & Conditions',
  description:
    'The rules the subscription runs on: billing, delivery, skips, cancellation and refunds.',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      updated="10 September 2026"
      intro="These are the rules your subscription runs on. Placing an order or starting a plan means you accept them. We have kept them short and specific, because terms nobody can read are terms nobody agreed to."
    >
      <LegalHeading>Who we are</LegalHeading>
      <p>
        Infinity Kitchens is a single cloud kitchen cooking a fixed daily menu
        for delivery. We are not a marketplace and we do not list dishes we do
        not cook ourselves.
      </p>

      <LegalHeading>Ordering</LegalHeading>
      <p>
        Meals are sold on subscription rather than one at a time. You pick a
        plan, set your delivery window and days, and we cook to that plan. While
        the website is still being finished, plans can also be set up over
        WhatsApp; a plan agreed that way runs on these same terms.
      </p>
      <p>
        An order is confirmed when we confirm it, not when it is submitted. If
        we cannot take an order -- your area is outside our delivery zone, or
        the kitchen is full for that window -- we will tell you and take no
        payment.
      </p>

      <LegalHeading>Prices and payment</LegalHeading>
      <p>
        Prices are per meal and include applicable taxes, shown at checkout.
        Delivery fees, where they apply, are shown before you pay.
      </p>
      <p>
        Plans are prepaid for one cycle. Where a plan renews automatically, that
        is stated on the plan before you buy it and again on your account, and
        you can turn it off at any time before the cycle ends. We may change
        prices for future cycles; a cycle you have already paid for runs at the
        price you paid.
      </p>

      <LegalHeading>Delivery</LegalHeading>
      <p>
        We deliver inside the window you choose. Bulk orders go anywhere in
        Bangalore; single and small orders are North Bangalore only.
      </p>
      <p>
        Someone needs to be able to receive the food. If nobody is reachable at
        the address during your window, the rider will wait a short while and
        then leave; that meal counts as delivered and is not refunded. Please
        keep your address and any landmark up to date -- an address we cannot
        find is the most common reason a delivery fails.
      </p>
      <p>
        Weather, traffic and the occasional kitchen problem can delay a
        delivery. We will tell you when we know.
      </p>

      <LegalHeading>Skips, pauses and changes</LegalHeading>
      <p>
        You can skip a meal or pause your plan from your account. A skipped meal
        returns to your balance rather than being lost, and a paused plan
        resumes where it left off.
      </p>
      <p>
        Skips and pauses have to reach us before the kitchen starts on that
        window. After the cut-off the food is already being cooked, so a skip
        applies to the next delivery instead of that one.
      </p>

      <LegalHeading>The menu</LegalHeading>
      <p>
        The menu is small and it changes. If a dish is off for the day we mark
        it unavailable on the menu with the reason. We do not quietly substitute
        something else for what you ordered.
      </p>
      <p>
        Please tell us about allergies before you start a plan. Our kitchen
        handles dairy, nuts, gluten and other common allergens, and we cannot
        guarantee that any dish is free of traces of them.
      </p>

      <LegalHeading>Cancellation and refunds</LegalHeading>
      <p>
        You can cancel a plan at any time. Cancelling stops the next renewal;
        the cycle you have paid for runs to its end, and the balance left on it
        stays available until it does.
      </p>
      <p>
        Food is perishable, so a delivered meal cannot be returned. If something
        arrives wrong, missing, spoiled or badly late, tell us within 24 hours
        with a photograph where you can, and we will refund that meal or credit
        it back to your balance. If we cancel a delivery, that meal is always
        credited or refunded.
      </p>
      <p>
        Refunds go back to the method you paid with. How long the money takes to
        appear is set by your bank, not by us.
      </p>

      <LegalHeading>Your account</LegalHeading>
      <p>
        Keep your sign-in to yourself and keep your contact details current. Ask
        us to close your account whenever you like; see the{' '}
        <Link href="/privacy" className="text-brand underline underline-offset-2">
          Privacy Policy
        </Link>{' '}
        for what happens to your data when you do.
      </p>
      <p>
        We may suspend an account that abuses staff, repeatedly refuses
        delivery, or uses the service fraudulently. Where we do, any balance you
        have paid for and not used is refunded.
      </p>

      <LegalHeading>Reviews</LegalHeading>
      <p>
        Reviews are welcome and we would rather read an honest bad one than no
        review at all. We remove reviews that are abusive, contain someone
        else&rsquo;s personal information, or are not about the food. We do not
        remove reviews for being negative.
      </p>

      <LegalHeading>What we are responsible for</LegalHeading>
      <p>
        We are responsible for the food we cook and for getting it to you as
        described. Where something goes wrong, our liability is limited to
        refunding or replacing the affected meals. Nothing here limits any right
        you have under Indian consumer law, and nothing here limits liability
        that cannot legally be limited.
      </p>

      <LegalHeading>Changes to these terms</LegalHeading>
      <p>
        We may update these terms. The date at the top says when they last
        changed, and a change that materially affects a plan you are on will be
        told to you rather than left for you to find.
      </p>

      <LegalHeading>Contact</LegalHeading>
      <p>
        Questions, complaints and anything else:{' '}
        <span className="font-semibold whitespace-nowrap text-ink tabular">
          +91 98803 70731
        </span>{' '}
        on WhatsApp.
      </p>
    </LegalPage>
  );
}
