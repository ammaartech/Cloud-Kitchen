import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { dateTime } from '@/lib/format';
import { Badge, Card, EmptyState, SectionHeading } from '@/components/ui/primitives';

/**
 * These screens are per-user by definition -- a session decides not just what
 * they show but whether you may see them at all -- so there is no static shell
 * to prerender and no point pretending otherwise. `instant = false` says that
 * plainly: this segment is allowed to block.
 *
 * It is a statement about *this* route, not a global escape hatch. The public
 * storefront next door is held to the opposite standard.
 */
export const instant = false;

export const metadata = { title: 'Audit log' };

interface AuditRow {
  id: number;
  occurred_at: string;
  actor_label: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changed_keys: string[] | null;
  context: Record<string, unknown>;
}

const ACTION_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  insert: 'success',
  update: 'info',
  delete: 'danger',
  state_transition: 'warning',
  config_change: 'warning',
  permission_change: 'danger',
  login: 'neutral',
  logout: 'neutral',
};

/**
 * The audit trail (PRD 17).
 *
 * Readable only by Developer Admin and Owner -- enforced by RLS, not by this
 * page, which is why an unauthorised session sees an empty table rather than a
 * leak. The log is append-only in the database: nothing here can edit it, and
 * neither can anything else.
 */
export default async function AuditPage({ searchParams }: PageProps<'/admin/audit'>) {
  await requirePermission(PERMISSIONS.auditView);

  const params = await searchParams;
  const entityFilter = typeof params.entity === 'string' ? params.entity : null;

  const supabase = await serverClient();

  let query = supabase
    .from('audit_logs')
    .select(
      'id, occurred_at, actor_label, actor_role, action, entity_type, entity_id, changed_keys, context',
    )
    .order('occurred_at', { ascending: false })
    .limit(150);

  if (entityFilter) query = query.eq('entity_type', entityFilter);

  const { data } = await query;
  const rows = (data ?? []) as unknown as AuditRow[];

  const entityTypes = [...new Set(rows.map((row) => row.entity_type))].sort();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <SectionHeading
        title="Audit log"
        description="Every privileged and operational change, with who made it and what changed. Append-only."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <a
          href="/admin/audit"
          className={
            entityFilter
              ? 'rounded-full border border-line px-3 py-1 text-sm text-muted hover:bg-sunken'
              : 'rounded-full bg-brand px-3 py-1 text-sm font-medium text-white'
          }
        >
          Everything
        </a>
        {entityTypes.map((type) => (
          <a
            key={type}
            href={`/admin/audit?entity=${type}`}
            className={
              entityFilter === type
                ? 'rounded-full bg-brand px-3 py-1 text-sm font-medium text-white'
                : 'rounded-full border border-line px-3 py-1 text-sm text-muted hover:bg-sunken'
            }
          >
            {type}
          </a>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Changes to the catalog, settings, orders and tickets will appear here."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs tracking-wide text-subtle uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Changed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-muted tabular">
                    {dateTime(row.occurred_at)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.actor_label ?? 'System'}</p>
                    {row.actor_role ? (
                      <p className="text-xs text-subtle">{row.actor_role.replace('_', ' ')}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={ACTION_TONE[row.action] ?? 'neutral'}>{row.action}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.entity_type}</p>
                    {row.entity_id ? (
                      <p className="font-mono text-xs text-subtle">
                        {row.entity_id.slice(0, 8)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {row.changed_keys?.length
                      ? row.changed_keys.join(', ')
                      : Object.keys(row.context ?? {}).length
                        ? JSON.stringify(row.context).slice(0, 120)
                        : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <p className="mt-3 text-xs text-subtle">
        Showing the most recent {rows.length} entries. Contact details and provider payloads
        are redacted at write time.
      </p>
    </div>
  );
}
