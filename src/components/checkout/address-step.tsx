import { Button, Card, Field, Input, Textarea } from '@/components/ui/primitives';

/** Collects the first delivery address. More can be added later (PRD 6). */
export function AddressStep({
  action,
  compact = false,
}: {
  action: (formData: FormData) => Promise<void>;
  compact?: boolean;
}) {
  const body = (
    <form action={action} className="mt-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Label">
          <Input name="label" defaultValue="Home" placeholder="Home, Office" />
        </Field>
        <Field label="Recipient name" required>
          <Input name="recipientName" required autoComplete="name" placeholder="Meera Iyer" />
        </Field>
      </div>

      <Field label="Mobile number" required>
        <Input
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="+91 98100 00000"
        />
      </Field>

      <Field label="Address line 1" required>
        <Input name="line1" required placeholder="Flat, building" autoComplete="address-line1" />
      </Field>

      <Field label="Address line 2">
        <Input name="line2" placeholder="Street, area" autoComplete="address-line2" />
      </Field>

      <Field label="Landmark" hint="Anything that helps the rider find you faster.">
        <Input name="landmark" placeholder="Opposite the Axis Bank ATM" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City" required>
          <Input name="city" required autoComplete="address-level2" placeholder="Bengaluru" />
        </Field>
        <Field label="State" required>
          <Input name="state" required autoComplete="address-level1" placeholder="Karnataka" />
        </Field>
        <Field label="PIN code" required>
          <Input
            name="postalCode"
            required
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="560001"
          />
        </Field>
      </div>

      <Field label="Delivery instructions">
        <Textarea name="instructions" placeholder="Call from the gate, the lift is slow" />
      </Field>

      <Button type="submit" size="lg" className="w-full">
        Save address
      </Button>
    </form>
  );

  if (compact) return body;

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Delivery address</h2>
      <p className="mt-1 text-sm text-muted">Where should we deliver?</p>
      {body}
    </Card>
  );
}
