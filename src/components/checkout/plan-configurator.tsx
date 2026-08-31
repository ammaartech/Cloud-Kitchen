'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import type { PlanSummary, ProductCard } from '@/lib/data/catalog';
import { money, weekdayName, clockTime } from '@/lib/format';
import { Alert, Badge, Button, Card, cx, Spinner, Textarea } from '@/components/ui/primitives';

/**
 * Configures a plan before checkout.
 *
 * Deliberately does no pricing arithmetic of its own -- it shows the plan price
 * and lets the server produce the real quote at checkout. A total computed here
 * would be a second source of truth, and the one the customer remembers.
 */
export function PlanConfigurator({
  plan,
  selectableMeals,
  action,
}: {
  plan: PlanSummary;
  selectableMeals: ProductCard[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [windowId, setWindowId] = useState(plan.windows[0]?.id ?? '');
  const [days, setDays] = useState<number[]>([]);
  const [meals, setMeals] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [pending, startTransition] = useTransition();

  const needsSelection = plan.planType === 'customer_selected';
  const requiredCount = plan.selectableMealCount ?? 0;
  const selectionComplete = !needsSelection || meals.length === requiredCount;
  const canContinue = Boolean(windowId) && selectionComplete;

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    );
  }

  function toggleMeal(productId: string) {
    setMeals((current) => {
      if (current.includes(productId)) return current.filter((id) => id !== productId);
      if (current.length >= requiredCount) return current;
      return [...current, productId];
    });
  }

  function submit() {
    const formData = new FormData();
    formData.set('planId', plan.id);
    formData.set('planSlug', plan.slug);
    formData.set('deliveryWindowId', windowId);
    formData.set('deliveryDays', JSON.stringify(days));
    formData.set(
      'selectedMeals',
      JSON.stringify(meals.map((productId) => ({ product_id: productId, quantity: 1 }))),
    );
    formData.set('deliveryInstructions', instructions);

    startTransition(() => {
      void action(formData);
    });
  }

  return (
    <div className="space-y-8">
      {/* -------------------------------------------------------------- */}
      {/* Delivery window                                                 */}
      {/* -------------------------------------------------------------- */}
      <section>
        <h2 className="font-semibold">Delivery window</h2>
        <p className="mt-1 text-sm text-muted">When should the food arrive?</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {plan.windows.map((window) => (
            <button
              key={window.id}
              type="button"
              onClick={() => setWindowId(window.id)}
              aria-pressed={windowId === window.id}
              className={cx(
                'rounded-ck border p-4 text-left transition-colors',
                windowId === window.id
                  ? 'border-brand bg-brand-soft'
                  : 'border-line-strong bg-surface hover:bg-sunken',
              )}
            >
              <p className="font-medium">{window.label}</p>
              <p className="mt-0.5 text-sm tabular text-muted">
                {clockTime(window.startsAt)} – {clockTime(window.endsAt)}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* Delivery days                                                   */}
      {/* -------------------------------------------------------------- */}
      <section>
        <h2 className="font-semibold">Delivery days</h2>
        <p className="mt-1 text-sm text-muted">
          Leave all unselected for every day. You can change this later.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              aria-pressed={days.includes(day)}
              className={cx(
                'h-10 w-14 rounded-ck border text-sm font-medium transition-colors',
                days.includes(day)
                  ? 'border-brand bg-brand text-white'
                  : 'border-line-strong bg-surface text-muted hover:bg-sunken',
              )}
            >
              {weekdayName(day)}
            </button>
          ))}
        </div>

        <p className="mt-2 text-xs text-subtle">
          {days.length === 0 ? 'Every day' : `${days.length} days a week`}
        </p>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* Meal selection (customer-selected plans only)                   */}
      {/* -------------------------------------------------------------- */}
      {needsSelection ? (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Choose your meals</h2>
            <Badge tone={selectionComplete ? 'success' : 'warning'}>
              {meals.length} of {requiredCount} chosen
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            Pick {requiredCount}. We will rotate through them across your cycle.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {selectableMeals.map((product) => {
              const chosen = meals.includes(product.id);
              const full = !chosen && meals.length >= requiredCount;
              const blocked = !product.isAvailable;

              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={blocked || full}
                  onClick={() => toggleMeal(product.id)}
                  aria-pressed={chosen}
                  className={cx(
                    'flex items-center gap-3 rounded-ck border p-3 text-left transition-colors',
                    chosen ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface',
                    !blocked && !full && 'hover:bg-sunken',
                    (blocked || full) && 'cursor-not-allowed opacity-55',
                    blocked && 'is-unavailable',
                  )}
                >
                  {product.imageUrl ? (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-ck bg-sunken">
                      <Image
                        src={product.imageUrl}
                        alt={product.imageAlt}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{product.name}</p>
                    <p className="text-xs text-subtle">
                      {blocked
                        ? (product.unavailableReason ?? 'Unavailable today')
                        : `${product.creditCost} credit${product.creditCost === 1 ? '' : 's'}`}
                    </p>
                  </div>

                  {chosen ? <Badge tone="brand">Chosen</Badge> : null}
                </button>
              );
            })}
          </div>

          {!selectionComplete ? (
            <p className="mt-3 text-sm text-warning">
              Choose {requiredCount - meals.length} more to continue.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* -------------------------------------------------------------- */}
      {/* Instructions                                                    */}
      {/* -------------------------------------------------------------- */}
      <section>
        <h2 className="font-semibold">Delivery instructions</h2>
        <p className="mt-1 text-sm text-muted">
          Anything the rider should know. Optional.
        </p>
        <Textarea
          className="mt-3"
          value={instructions}
          maxLength={500}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder="Call from the gate, the lift is slow"
        />
      </section>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Plan price</p>
            <p className="text-2xl font-semibold tabular">{money(plan.price)}</p>
            <p className="text-xs text-subtle">
              Taxes and any offer are calculated at checkout.
            </p>
          </div>

          <Button size="lg" onClick={submit} disabled={!canContinue || pending}>
            {pending ? <Spinner /> : null}
            Continue to checkout
          </Button>
        </div>
      </Card>

      {!canContinue ? (
        <Alert tone="warning">
          {!windowId
            ? 'Choose a delivery window to continue.'
            : `Choose ${requiredCount} meals to continue.`}
        </Alert>
      ) : null}
    </div>
  );
}
