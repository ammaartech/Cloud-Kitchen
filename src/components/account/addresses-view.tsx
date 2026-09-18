import { RememberShape } from './account-shape';
import { Enter } from './account-shell';
import { ActionFeedback } from '@/lib/admin/feedback';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  FieldAction,
  Input,
  Textarea,
} from '@/components/ui/primitives';

export interface Address {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postal_code: string;
  delivery_instructions: string | null;
  is_default: boolean;
  is_active: boolean;
}

type FormAction = (formData: FormData) => void | Promise<void>;

/**
 * The addresses page, as a composition over plain rows -- the same split the
 * overview makes. The page reads the database and owns the Server Actions;
 * this only arranges what it is handed, which is what lets the page's skeleton
 * (`AddressesSkeleton`) be checked against it with fixed rows.
 */
export function AddressesView({
  active,
  retiredCount,
  inUse,
  recipient,
  feedback,
  actions,
}: {
  active: Address[];
  retiredCount: number;
  /** Ids of the addresses a live plan delivers to. */
  inUse: string[];
  /** Prefills for the add form. */
  recipient: { name: string; phone: string | null };
  feedback: { error?: string; ok?: string };
  actions: { save: FormAction; makeDefault: FormAction; retire: FormAction };
}) {
  return (
    <>
      <RememberShape
        page="addresses"
        shape={{ customer: true, cards: active.length, retired: retiredCount > 0 }}
        measure={{
          card: '[data-shape-card]',
          cardTexts: {
            label: '[data-text="label"]',
            default: '[data-text="default"]',
            inUse: '[data-text="in-use"]',
            whom: '[data-text="whom"]',
            where: '[data-text="where"]',
            note: '[data-text="note"]',
            makeDefault: '[data-text="make-default"]',
            remove: '[data-text="remove"]',
          },
        }}
      />
      <ActionFeedback error={feedback.error} ok={feedback.ok} />

      {active.length === 0 ? (
        <Enter index={1}>
          <EmptyState
            title="No addresses saved"
            description="Add one below and it will be ready at checkout."
          />
        </Enter>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {active.map((address, index) => (
            <Enter key={address.id} index={1 + Math.min(index, 5)}>
            <Card className="acct-card h-full p-4" data-shape-card="">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium" data-text="label">
                  {address.label}
                </p>
                {address.is_default ? (
                  <span data-text="default" className="contents">
                    <Badge tone="brand">Default</Badge>
                  </span>
                ) : null}
                {inUse.includes(address.id) ? (
                  <span data-text="in-use" className="contents">
                    <Badge tone="success">In use by a plan</Badge>
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-sm text-muted" data-text="whom">
                {address.recipient_name} · {address.phone}
              </p>
              <p className="mt-1 text-sm text-muted" data-text="where">
                {[address.line1, address.line2, address.landmark].filter(Boolean).join(', ')},{' '}
                {address.city}, {address.state} {address.postal_code}
              </p>

              {address.delivery_instructions ? (
                <p className="mt-2 rounded-ck bg-sunken px-3 py-2 text-xs text-muted" data-text="note">
                  {address.delivery_instructions}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!address.is_default ? (
                  <form action={actions.makeDefault} data-text="make-default">
                    <input type="hidden" name="addressId" value={address.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Make default
                    </Button>
                  </form>
                ) : null}

                {!inUse.includes(address.id) ? (
                  <form action={actions.retire} className="ml-auto" data-text="remove">
                    <input type="hidden" name="addressId" value={address.id} />
                    <ConfirmButton confirmLabel="Really remove?">Remove</ConfirmButton>
                  </form>
                ) : (
                  <span className="ml-auto text-xs text-subtle">
                    Used by a live plan: change the plan first
                  </span>
                )}
              </div>

              <details className="acct-details mt-3 border-t border-line pt-3">
                <summary className="acct-details-summary">Edit this address</summary>

                <form action={actions.save} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="addressId" value={address.id} />

                  <Field label="Label">
                    <Input name="label" defaultValue={address.label} />
                  </Field>
                  <Field label="Recipient" required>
                    <Input name="recipientName" defaultValue={address.recipient_name} required />
                  </Field>
                  <Field label="Phone" required>
                    <Input name="phone" defaultValue={address.phone} inputMode="tel" required />
                  </Field>
                  <Field label="Landmark">
                    <Input name="landmark" defaultValue={address.landmark ?? ''} />
                  </Field>

                  <div className="sm:col-span-2">
                    <Field label="Address line 1" required>
                      <Input name="line1" defaultValue={address.line1} required />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Address line 2">
                      <Input name="line2" defaultValue={address.line2 ?? ''} />
                    </Field>
                  </div>

                  <Field label="City" required>
                    <Input name="city" defaultValue={address.city} required />
                  </Field>
                  <Field label="State" required>
                    <Input name="state" defaultValue={address.state} required />
                  </Field>
                  <Field label="Postcode" required>
                    <Input name="postalCode" defaultValue={address.postal_code} required />
                  </Field>

                  <div className="sm:col-span-2">
                    <Field label="Delivery instructions" hint="Gate code, which bell, where to leave it.">
                      <Textarea
                        name="deliveryInstructions"
                        defaultValue={address.delivery_instructions ?? ''}
                        className="min-h-16"
                      />
                    </Field>
                  </div>

                  <label className="flex items-center gap-2 self-end text-sm">
                    <input
                      type="checkbox"
                      name="isDefault"
                      defaultChecked={address.is_default}
                      className="h-4 w-4"
                    />
                    Default address
                  </label>

                  <FieldAction>
                    <Button type="submit" size="sm" variant="secondary">
                      Save changes
                    </Button>
                  </FieldAction>
                </form>
              </details>
            </Card>
            </Enter>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Add                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Enter index={2 + Math.min(active.length, 5)} className="mt-8">
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Add an address</h2>

        <form action={actions.save} className="grid gap-4 sm:grid-cols-3">
          <Field label="Label" hint="Home, Office, Mum’s…">
            <Input name="label" defaultValue="Home" />
          </Field>

          <Field label="Recipient" required>
            <Input name="recipientName" defaultValue={recipient.name} required />
          </Field>

          <Field label="Phone" required>
            <Input name="phone" defaultValue={recipient.phone ?? ''} inputMode="tel" required />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Address line 1" required>
              <Input name="line1" placeholder="Flat, building, street" required />
            </Field>
          </div>

          <Field label="Landmark">
            <Input name="landmark" placeholder="Opposite the Axis Bank ATM" />
          </Field>

          <div className="sm:col-span-3">
            <Field label="Address line 2">
              <Input name="line2" placeholder="Area, locality" />
            </Field>
          </div>

          <Field label="City" required>
            <Input name="city" required placeholder="Bengaluru" />
          </Field>
          <Field label="State" required>
            <Input name="state" required placeholder="Karnataka" />
          </Field>
          <Field label="Postcode" required>
            <Input name="postalCode" inputMode="numeric" required placeholder="560001" />
          </Field>

          <div className="sm:col-span-3">
            <Field
              label="Delivery instructions"
              hint="Anything the rider needs to know. This reaches the kitchen too."
            >
              <Textarea
                name="deliveryInstructions"
                className="min-h-16"
                placeholder="Call from the gate, the lift is slow"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              name="isDefault"
              className="h-4 w-4"
              defaultChecked={active.length === 0}
            />
            Make this my default
          </label>

          <FieldAction>
            <Button type="submit">Save address</Button>
          </FieldAction>
        </form>
      </Card>
      </Enter>

      {retiredCount > 0 ? (
        <p className="mt-4 text-xs text-subtle">
          {retiredCount} removed address(es) are kept out of sight so past deliveries still read
          correctly.
        </p>
      ) : null}
    </>
  );
}

/** A signed-in account with no customer record: staff, usually. */
export function AddressesNoCustomer() {
  return (
    <Enter index={1}>
      <RememberShape page="addresses" shape={{ customer: false, cards: 0, retired: false }} />
      <EmptyState
        title="No customer record yet"
        description="Addresses appear here once you have placed your first order."
        action={
          <ButtonLink href="/subscriptions">Browse plans</ButtonLink>
        }
      />
    </Enter>
  );
}
