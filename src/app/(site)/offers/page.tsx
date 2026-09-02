import { listPublicOffers } from '@/lib/data/catalog';
import { money, dateOnly } from '@/lib/format';
import { Badge, ButtonLink, Card, EmptyState } from '@/components/ui/primitives';
import { SignedOutNotice } from '@/components/site/signed-out-notice';

export const metadata = {
  title: 'Offers',
  description: 'Current offers, and who they apply to.',
};

export default async function OffersPage() {
  // Offers are the same rows for everybody and already cached. Whether *you*
  // are signed in is the only per-visitor thing on this page, and it decides
  // one advisory notice at the bottom -- so it is resolved in the browser
  // rather than costing the whole route its prerender. See `(site)/layout.tsx`.
  const offers = await listPublicOffers();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Offers</h1>
        <p className="mt-2 text-muted text-pretty">
          What is running right now. Eligibility is checked when you order, so an offer shown
          here may still not apply to your account — we will say why at checkout rather than
          failing quietly.
        </p>
      </header>

      {offers.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No offers are running"
            description="When the kitchen publishes an offer, it will appear here."
          />
        </div>
      ) : (
        <div className="mt-10 space-y-4">
          {offers.map((offer) => (
            <Card key={offer.code} className="flex flex-wrap items-center gap-6 p-6">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{offer.name}</h2>
                  <Badge tone="accent">Unlocked</Badge>
                </div>

                <p className="mt-1 text-sm text-muted">{offer.description}</p>

                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-subtle">
                  <div className="flex gap-1">
                    <dt>Code</dt>
                    <dd className="font-mono font-medium text-muted">{offer.code}</dd>
                  </div>
                  {Number(offer.minOrderAmount) > 0 ? (
                    <div className="flex gap-1">
                      <dt>Minimum</dt>
                      <dd className="font-medium text-muted">{money(offer.minOrderAmount)}</dd>
                    </div>
                  ) : null}
                  {offer.maxDiscountAmount ? (
                    <div className="flex gap-1">
                      <dt>Capped at</dt>
                      <dd className="font-medium text-muted">
                        {money(offer.maxDiscountAmount)}
                      </dd>
                    </div>
                  ) : null}
                  {offer.validUntil ? (
                    <div className="flex gap-1">
                      <dt>Ends</dt>
                      <dd className="font-medium text-muted">{dateOnly(offer.validUntil)}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="text-right">
                <p className="text-3xl font-semibold tabular text-brand">
                  {offer.discountType === 'percent'
                    ? `${Number(offer.discountValue)}%`
                    : money(offer.discountValue)}
                </p>
                <p className="text-xs text-subtle">off</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SignedOutNotice>
        Create one at checkout — we only ask for details once you have chosen a plan.
      </SignedOutNotice>

      <div className="mt-10 text-center">
        <ButtonLink href="/subscriptions" size="lg">Choose a plan</ButtonLink>
      </div>
    </div>
  );
}
