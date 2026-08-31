import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { money, clockTime } from '@/lib/format';
import { Alert, Badge, Button, Card, Input, SectionHeading } from '@/components/ui/primitives';
import { ActionFeedback, done, fail, readable } from '@/lib/admin/feedback';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

const PATH = '/admin/settings';

interface SettingRow {
  key: string;
  value: unknown;
  value_type: string;
  group_name: string;
  label: string;
  description: string;
  is_provisional: boolean;
}

const GROUP_TITLES: Record<string, string> = {
  business: 'Business',
  subscription: 'Subscription rules',
  kot: 'Kitchen and KOT',
  payments: 'Payments',
  offers: 'Offers',
  integrations: 'Integrations',
  general: 'General',
};

/**
 * Business settings (PRD 20).
 *
 * This screen is the proof that nothing business-critical is hardcoded: the
 * grace period, pause limits, KOT release lead time, tax rates, delivery fee
 * and cost assumptions are all rows, editable here, and take effect on the
 * next request with no deploy.
 *
 * Values the Owner has not yet confirmed are marked provisional rather than
 * being presented as settled policy (PRD 22).
 */
export default async function SettingsPage({ searchParams }: PageProps<'/admin/settings'>) {
  await requirePermission(PERMISSIONS.settingsManage);
  const supabase = await serverClient();
  const params = await searchParams;

  const [settingsResult, taxResult, deliveryResult, costResult, windowResult] =
    await Promise.all([
      supabase
        .from('business_settings')
        .select('key, value, value_type, group_name, label, description, is_provisional')
        .order('group_name')
        .order('key'),
      supabase
        .from('tax_settings')
        .select('id, code, label, rate_percent, applies_to, is_active, is_provisional')
        .eq('is_active', true)
        .order('code'),
      supabase
        .from('delivery_settings')
        .select('id, name, base_fee, free_above_subtotal, is_active')
        .eq('is_active', true),
      supabase
        .from('cost_settings')
        .select(
          'id, source, label, commission_percent, payment_fee_percent, packaging_cost_per_order, default_food_cost_percent, is_dummy_data',
        )
        .eq('is_active', true),
      supabase
        .from('delivery_windows')
        .select('id, code, label, starts_at, ends_at, cutoff_minutes_before, is_active')
        .order('sort_order'),
    ]);

  const settings = (settingsResult.data ?? []) as unknown as SettingRow[];
  const taxes = (taxResult.data ?? []) as Array<Record<string, string | boolean>>;
  const delivery = (deliveryResult.data ?? []) as Array<Record<string, string>>;
  const costs = (costResult.data ?? []) as Array<Record<string, string | boolean | null>>;
  const windows = (windowResult.data ?? []) as Array<Record<string, string | number | boolean>>;

  /** Writes a setting. RLS re-checks `settings.manage` on the way in. */
  async function updateSetting(formData: FormData) {
    'use server';

    const key = String(formData.get('key'));
    const label = String(formData.get('label') ?? '') || key;
    const raw = String(formData.get('value') ?? '');
    const valueType = String(formData.get('valueType'));

    // Stored as jsonb, so the type has to survive the round trip: a number
    // written as a string would break `setting_int` at read time. An input
    // that cannot round-trip is refused with a reason, never swallowed --
    // an Owner who clicks Save and sees nothing believes the value changed.
    let value: unknown;
    if (valueType === 'integer' || valueType === 'number') {
      value = Number(raw);
      if (Number.isNaN(value)) {
        fail(PATH, `"${label}" needs a number — "${raw}" is not one. Nothing was changed.`);
      }
    } else if (valueType === 'boolean') {
      value = raw === 'true';
    } else if (valueType === 'json') {
      try {
        value = JSON.parse(raw);
      } catch {
        fail(PATH, `"${label}" needs valid JSON. Nothing was changed.`);
      }
    } else {
      value = raw;
    }

    const db = await serverClient();
    const { error } = await db.from('business_settings').update({ value }).eq('key', key);

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    done(PATH, `"${label}" saved. It takes effect on the next request.`);
  }

  const groups = [...new Set(settings.map((setting) => setting.group_name))];
  const provisionalCount = settings.filter((setting) => setting.is_provisional).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <SectionHeading
        title="Business settings"
        description="Everything here is data. Changing a value takes effect immediately — no deployment involved."
      />

      <ActionFeedback
        error={typeof params.error === 'string' ? params.error : undefined}
        ok={typeof params.ok === 'string' ? params.ok : undefined}
      />

      {provisionalCount > 0 ? (
        <div className="mb-6">
          <Alert tone="warning" title={`${provisionalCount} values still need your sign-off`}>
            These are working defaults taken from the PRD, not confirmed policy. They are
            marked provisional below.
          </Alert>
        </div>
      ) : null}

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group}>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
              {GROUP_TITLES[group] ?? group}
            </h2>

            <Card className="divide-y divide-line">
              {settings
                .filter((setting) => setting.group_name === group)
                .map((setting) => {
                  const raw =
                    setting.value_type === 'json'
                      ? JSON.stringify(setting.value)
                      : String(setting.value);

                  return (
                    <form
                      key={setting.key}
                      action={updateSetting}
                      className="flex flex-wrap items-end gap-4 p-4"
                    >
                      <input type="hidden" name="key" value={setting.key} />
                      <input type="hidden" name="label" value={setting.label} />
                      <input type="hidden" name="valueType" value={setting.value_type} />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{setting.label}</span>
                          {setting.is_provisional ? (
                            <Badge tone="warning">Provisional</Badge>
                          ) : null}
                        </div>
                        {setting.description ? (
                          <p className="mt-0.5 text-xs text-muted">{setting.description}</p>
                        ) : null}
                        <p className="mt-0.5 font-mono text-xs text-subtle">{setting.key}</p>
                      </div>

                      <div className="flex items-end gap-2">
                        {setting.value_type === 'boolean' ? (
                          <select
                            name="value"
                            defaultValue={raw}
                            className="h-10 rounded-ck border border-line-strong bg-surface px-3 text-sm"
                          >
                            <option value="true">Enabled</option>
                            <option value="false">Disabled</option>
                          </select>
                        ) : (
                          <Input
                            name="value"
                            defaultValue={raw}
                            className="w-56"
                            inputMode={
                              setting.value_type === 'integer' ? 'numeric' : undefined
                            }
                          />
                        )}
                        <Button type="submit" variant="secondary" size="md">
                          Save
                        </Button>
                      </div>
                    </form>
                  );
                })}
            </Card>
          </section>
        ))}

        {/* -------------------------------------------------------------- */}
        {/* Rate tables, read-only here                                     */}
        {/* -------------------------------------------------------------- */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Tax components
          </h2>
          <Card className="p-4">
            <ul className="space-y-2 text-sm">
              {taxes.map((tax) => (
                <li key={String(tax.id)} className="flex items-center justify-between gap-3">
                  <span>
                    <span className="font-medium">{String(tax.code)}</span>{' '}
                    <span className="text-muted">on {String(tax.applies_to)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular">{Number(tax.rate_percent)}%</span>
                    {tax.is_provisional ? <Badge tone="warning">Provisional</Badge> : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-subtle">
              Phase 1 assumes 5% food tax split into two components. Production GST treatment
              needs validation before go-live.
            </p>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Delivery fee
          </h2>
          <Card className="p-4">
            <ul className="space-y-2 text-sm">
              {delivery.map((rule) => (
                <li key={rule.id} className="flex items-center justify-between gap-3">
                  <span className="font-medium">{rule.name}</span>
                  <span className="text-muted">
                    {money(rule.base_fee)}
                    {rule.free_above_subtotal
                      ? `, free above ${money(rule.free_above_subtotal)}`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Cost assumptions
          </h2>
          <Card className="p-4">
            <ul className="space-y-3 text-sm">
              {costs.map((cost) => (
                <li key={String(cost.id)}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{String(cost.label)}</span>
                    {cost.source ? <Badge tone="neutral">{String(cost.source)}</Badge> : null}
                    {cost.is_dummy_data ? <Badge tone="warning">Placeholder</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {Number(cost.commission_percent)}% commission ·{' '}
                    {Number(cost.payment_fee_percent)}% payment fee ·{' '}
                    {money(String(cost.packaging_cost_per_order))} packaging ·{' '}
                    {Number(cost.default_food_cost_percent)}% default food cost
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-subtle">
              These feed estimated profit. While marked as placeholders, treat profit figures
              as directional only.
            </p>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Delivery windows
          </h2>
          <Card className="p-4">
            <ul className="space-y-2 text-sm">
              {windows.map((window) => (
                <li key={String(window.id)} className="flex items-center justify-between gap-3">
                  <span>
                    <span className="font-medium">{String(window.label)}</span>{' '}
                    <span className="font-mono text-xs text-subtle">
                      {String(window.code)}
                    </span>
                  </span>
                  <span className="text-muted tabular">
                    {clockTime(String(window.starts_at))} – {clockTime(String(window.ends_at))}
                    <span className="ml-2 text-xs text-subtle">
                      cut-off {Number(window.cutoff_minutes_before) / 60}h
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </div>
  );
}
