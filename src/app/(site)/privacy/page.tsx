import { LegalPage, LegalHeading } from '@/components/site/legal';

/**
 * What the kitchen holds about you, and why.
 *
 * Written from what the application actually does rather than from a template.
 * Every category named below corresponds to something real in this codebase --
 * addresses to `account/addresses`, orders and invoices to the order tables,
 * reviews to `account/reviews`, refunds to `account/refunds`, payments to the
 * Razorpay integration in `lib/payments`, and the WhatsApp route to the poster
 * page. If a feature is removed, the paragraph naming it should go with it: a
 * policy that lists data the kitchen no longer collects is as wrong as one that
 * omits data it does.
 *
 * TODO(ops): three facts here have to come from the business before this is
 * relied on as the published policy -- the registered entity name and address,
 * the FSSAI licence number, and the grievance officer's name and email that
 * Indian consumer rules require to be published. They are deliberately not
 * invented here; the contact section names the WhatsApp line, which is true.
 */
export const metadata = {
  title: 'Privacy Policy',
  description: 'What we collect, why we hold it, and how to have it removed.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="10 September 2026"
      intro="This explains what we collect when you order from us, why we hold it, and what you can ask us to do with it. We have tried to write it in the same plain language we use everywhere else on this site."
    >
      <LegalHeading>What we collect</LegalHeading>
      <p>
        <strong className="text-ink">Your account.</strong> Your name, phone
        number and email address, so we know who is ordering and can reach you
        about a delivery that is running late.
      </p>
      <p>
        <strong className="text-ink">Your addresses.</strong> Where we deliver,
        including any landmark or instruction you add. Riders see the address
        for the delivery they are on and nothing else.
      </p>
      <p>
        <strong className="text-ink">Your orders and subscriptions.</strong>{' '}
        What you ordered, which plan you are on, which meals you skipped or
        paused, your delivery windows, and the invoices raised against them.
      </p>
      <p>
        <strong className="text-ink">Payments.</strong> Payments are handled by
        our payment gateway. We receive confirmation that a payment succeeded or
        failed and a reference for it. We never see or store your card number,
        UPI PIN or bank credentials.
      </p>
      <p>
        <strong className="text-ink">Messages you send us.</strong> If you order
        or ask a question over WhatsApp, that conversation sits in WhatsApp and
        is subject to their terms as well as ours.
      </p>
      <p>
        <strong className="text-ink">Reviews.</strong> Anything you write about
        a dish, shown with the name on your account.
      </p>

      <LegalHeading>Why we hold it</LegalHeading>
      <p>
        To cook and deliver what you ordered, to take payment for it, to handle
        refunds and complaints, and to keep the books and invoices a food
        business is required to keep. We also use aggregate figures -- how many
        portions went out, which dishes sell -- to plan the next day&rsquo;s
        cooking. That work is done on totals, not on individuals.
      </p>

      <LegalHeading>Marketing</LegalHeading>
      <p>
        We will only send you offers if you have said we can. Marketing consent
        is a separate switch from your account: turning one off does not
        silently change the other, and you can withdraw it at any time from your
        account or by telling us. Messages about an order you have actually
        placed -- a delivery confirmation, a payment receipt, a dish that has
        gone unavailable -- are not marketing and will keep coming while the
        order is live.
      </p>

      <LegalHeading>Who else sees it</LegalHeading>
      <p>
        Our kitchen and delivery staff, to the extent they need it to get your
        food to you. Our payment gateway, to take the payment. Our hosting and
        database providers, who store the data on our behalf. Nobody else. We do
        not sell your data, and we do not share it with advertisers.
      </p>
      <p>
        We may disclose records where the law requires it -- a court order, a
        tax or food-safety authority acting within its powers.
      </p>

      <LegalHeading>How long we keep it</LegalHeading>
      <p>
        Order, invoice and payment records are kept for as long as tax and
        accounting rules require us to hold them. Everything else -- your saved
        addresses, your preferences, your reviews -- we keep while your account
        is open.
      </p>
      <p>
        If you close your account we disable the login and stop marketing to you
        immediately. The business records above stay, because we are required to
        hold them. We are not keeping them to keep selling to you.
      </p>

      <LegalHeading>What you can ask for</LegalHeading>
      <p>
        You can ask us for a copy of what we hold about you, ask us to correct
        anything that is wrong, ask us to delete what we are not required to
        keep, or withdraw marketing consent. Message us and we will confirm the
        request and act on it. We may ask you to confirm your identity first,
        which is protection for you rather than an obstacle.
      </p>

      <LegalHeading>Cookies</LegalHeading>
      <p>
        We use the cookies needed to keep you signed in and to remember what is
        in your cart. There is no advertising or cross-site tracking on this
        site. Clearing them signs you out; nothing else breaks.
      </p>

      <LegalHeading>Children</LegalHeading>
      <p>
        This service is meant for adults. We do not knowingly create accounts
        for anyone under 18.
      </p>

      <LegalHeading>Changes</LegalHeading>
      <p>
        If we change this policy we will update the date at the top. If a change
        materially affects what we do with your data, we will tell you rather
        than rely on you noticing the date.
      </p>

      <LegalHeading>Contact</LegalHeading>
      <p>
        The fastest way to reach us about anything on this page is the same
        WhatsApp line we take orders on:{' '}
        <span className="font-semibold whitespace-nowrap text-ink tabular">
          +91 98803 70731
        </span>
        .
      </p>
    </LegalPage>
  );
}
