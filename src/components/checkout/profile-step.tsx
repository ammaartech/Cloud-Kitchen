import { Button, Card, Field, Input } from '@/components/ui/primitives';

/**
 * The required profile data from PRD 6: full name, mobile and a delivery
 * address (collected next). Marketing consent is asked for separately and
 * defaults to off -- it is not bundled into "create my account".
 */
export function ProfileStep({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <Card className="p-6">
      <h2 className="font-semibold">Your details</h2>
      <p className="mt-1 text-sm text-muted">
        We need a name and a number so the kitchen and the rider can reach you.
      </p>

      <form action={action} className="mt-5 space-y-4">
        <Field label="Full name" required>
          <Input name="fullName" required autoComplete="name" placeholder="Meera Iyer" />
        </Field>

        <Field label="Mobile number" required hint="Used for delivery updates.">
          <Input
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            placeholder="+91 98100 00000"
          />
        </Field>

        <label className="flex items-start gap-3 rounded-ck border border-line bg-sunken p-3">
          <input type="checkbox" name="marketingConsent" className="mt-0.5" />
          <span className="text-sm">
            <span className="font-medium">Send me occasional offers</span>
            <span className="mt-0.5 block text-xs text-muted">
              Optional, and separate from your account. You can change it at any time without
              affecting your subscription.
            </span>
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full">
          Save and continue
        </Button>
      </form>
    </Card>
  );
}
