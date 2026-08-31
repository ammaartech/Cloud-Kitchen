import { ButtonLink, Card } from '@/components/ui/primitives';

export const metadata = { title: 'Not found' };

/**
 * Renders for a bad URL, and for anything a page resolves with `notFound()` --
 * a plan slug that no longer exists, an archived dish, a customer id that was
 * never real.
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <Card className="p-8">
        <h1 className="text-xl font-semibold tracking-tight">We could not find that</h1>
        <p className="mt-2 text-sm text-muted">
          The page may have moved, or the thing it pointed at is no longer available.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href="/">Home</ButtonLink>
          <ButtonLink href="/menu" variant="secondary">See the menu</ButtonLink>
          <ButtonLink href="/subscriptions" variant="secondary">Subscription plans</ButtonLink>
        </div>
      </Card>
    </div>
  );
}
