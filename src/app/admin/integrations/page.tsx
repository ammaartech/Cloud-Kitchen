import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { dateTime } from '@/lib/format';
import { Alert, Badge, Card, EmptyState, SectionHeading } from '@/components/ui/primitives';

export const metadata = { title: 'Integrations' };
export const dynamic = 'force-dynamic';

interface HealthRow {
  provider: string;
  display_name: string;
  is_enabled: boolean;
  health: string;
  last_healthy_at: string | null;
  last_error_at: string | null;
  consecutive_failures: number;
  circuit_open_until: string | null;
  has_credentials_configured: boolean;
  capabilities: Array<{
    capability: string;
    state: string;
    notes: string;
    reference_url: string | null;
  }>;
  failed_events_24h: number;
  last_reconciliation_status: string | null;
}

const CAPABILITY_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  integrated: 'success',
  mocked: 'warning',
  blocked: 'danger',
};

const CAPABILITY_MEANING: Record<string, string> = {
  integrated: 'Calls a real, documented endpoint.',
  mocked: 'Logic is implemented and testable against the mock transport.',
  blocked: 'Not available. Calls are refused rather than guessed.',
};

/**
 * Marketplace integration health (PRD 16, PRD 23).
 *
 * The point of this screen is honesty. Every capability is labelled
 * integrated, mocked or blocked, straight from `integration_capabilities`, so
 * nobody reading it can come away believing Swiggy or Zomato are connected
 * when they are not.
 */
export default async function IntegrationsPage() {
  await requirePermission(PERMISSIONS.integrationsView);
  const supabase = await serverClient();

  const [healthResult, reconResult] = await Promise.all([
    supabase.from('v_integration_health').select('*'),
    supabase
      .from('integration_reconciliation')
      .select('id, provider, ran_at, status, external_count, internal_count, missing_internal, missing_external')
      .order('ran_at', { ascending: false })
      .limit(10),
  ]);

  const providers = (healthResult.data ?? []) as unknown as HealthRow[];
  const reconciliations = (reconResult.data ?? []) as Array<{
    id: string;
    provider: string;
    ran_at: string;
    status: string;
    external_count: number;
    internal_count: number;
    missing_internal: string[];
    missing_external: string[];
  }>;

  const anyIntegrated = providers.some((provider) =>
    provider.capabilities.some((capability) => capability.state === 'integrated'),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <SectionHeading
        title="Marketplace integrations"
        description="What is actually connected, and what is not."
      />

      {!anyIntegrated ? (
        <div className="mb-6">
          <Alert tone="info" title="No marketplace is live">
            Swiggy and Zomato grant partner API access per merchant, under contract. Until
            those credentials and their documentation exist, every capability below is marked
            blocked and the adapters refuse to call anything. Orders can still be ingested
            through the webhook endpoint for testing.
          </Alert>
        </div>
      ) : null}

      {providers.length === 0 ? (
        <EmptyState title="No marketplace accounts configured" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {providers.map((provider) => (
            <Card key={provider.provider} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{provider.display_name}</h2>
                  <p className="mt-0.5 text-sm text-muted">
                    {provider.is_enabled ? 'Enabled' : 'Not enabled'} ·{' '}
                    {provider.has_credentials_configured
                      ? 'credentials reference set'
                      : 'no credentials'}
                  </p>
                </div>

                <Badge
                  tone={
                    provider.health === 'connected'
                      ? 'success'
                      : provider.health === 'degraded'
                        ? 'warning'
                        : provider.health === 'down'
                          ? 'danger'
                          : 'neutral'
                  }
                >
                  {provider.health}
                </Badge>
              </div>

              {provider.circuit_open_until ? (
                <div className="mt-4">
                  <Alert tone="danger" title="Circuit open">
                    {provider.consecutive_failures} consecutive failures. Outbound calls to
                    this marketplace are suspended until {dateTime(provider.circuit_open_until)}.
                    Other channels are unaffected.
                  </Alert>
                </div>
              ) : null}

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-subtle">Last healthy</dt>
                  <dd className="mt-0.5">{dateTime(provider.last_healthy_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Failed events (24h)</dt>
                  <dd className="mt-0.5 tabular">{provider.failed_events_24h}</dd>
                </div>
              </dl>

              <h3 className="mt-5 text-xs font-semibold tracking-wide text-subtle uppercase">
                Capabilities
              </h3>

              <ul className="mt-2 space-y-2">
                {provider.capabilities.map((capability) => (
                  <li
                    key={capability.capability}
                    className="rounded-ck border border-line bg-sunken p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {capability.capability.replace(/_/g, ' ')}
                      </span>
                      <Badge tone={CAPABILITY_TONE[capability.state] ?? 'neutral'}>
                        {capability.state}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {capability.notes || CAPABILITY_MEANING[capability.state]}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Reconciliation history                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-10">
        <SectionHeading
          title="Reconciliation runs"
          description="Two-way comparison between what the platform reports and what we hold. Discrepancies are recorded, never silently corrected."
        />

        {reconciliations.length === 0 ? (
          <EmptyState
            title="No reconciliation has run"
            description="Trigger one from the scheduled job endpoint."
          />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs tracking-wide text-subtle uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Ran</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                  <th className="px-4 py-3 text-right font-medium">Theirs</th>
                  <th className="px-4 py-3 text-right font-medium">Ours</th>
                  <th className="px-4 py-3 font-medium">Discrepancies</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations.map((run) => (
                  <tr key={run.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {dateTime(run.ran_at)}
                    </td>
                    <td className="px-4 py-3">{run.provider}</td>
                    <td className="px-4 py-3">
                      <Badge tone={run.status === 'clean' ? 'success' : 'warning'}>
                        {run.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular">{run.external_count}</td>
                    <td className="px-4 py-3 text-right tabular">{run.internal_count}</td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {run.missing_internal?.length
                        ? `${run.missing_internal.length} missing here`
                        : ''}
                      {run.missing_internal?.length && run.missing_external?.length ? ', ' : ''}
                      {run.missing_external?.length
                        ? `${run.missing_external.length} unknown to them`
                        : ''}
                      {!run.missing_internal?.length && !run.missing_external?.length ? '—' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
