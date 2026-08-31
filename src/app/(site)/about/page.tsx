export const metadata = {
  title: 'About',
  description: 'One brand, one branch, one kitchen.',
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">About us</h1>

      <div className="mt-6 space-y-5 text-muted text-pretty">
        <p>
          We are a single kitchen serving a single neighbourhood. Not a chain, not a
          franchise, not a marketplace listing a thousand dishes it does not cook.
        </p>
        <p>
          That constraint is deliberate. A small menu means we buy fresh for the day, cook
          in batches that finish, and know exactly how many portions are going out. It is
          also why we sell subscriptions rather than one-off orders — knowing what the day
          looks like before it starts is what keeps the food good.
        </p>

        <h2 className="pt-4 text-xl font-semibold text-ink">How we handle your food</h2>
        <p>
          Meals enter the kitchen queue shortly before your delivery window, not the night
          before. If a dish is off for the day, we mark it unavailable on the menu with the
          reason rather than quietly substituting something.
        </p>

        <h2 className="pt-4 text-xl font-semibold text-ink">How we handle your data</h2>
        <p>
          We keep the records a food business has to keep: your orders, invoices and
          deliveries. If you close your account we disable the login and stop marketing to
          you, but those business records stay, because we are required to hold them.
        </p>
        <p>
          Marketing consent is a separate switch from your account. Turning one off does not
          silently change the other.
        </p>
      </div>
    </div>
  );
}
