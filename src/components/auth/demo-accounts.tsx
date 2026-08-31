'use client';

import { useState } from 'react';
import type { DemoAccount, DemoAccountList } from '@/lib/auth/demo-accounts';
import { ROLE_LABELS } from '@/lib/auth/demo-accounts';
import { Badge, Button, Card, cx } from '@/components/ui/primitives';

/**
 * Development panel listing the seeded accounts (see `demo-accounts.ts` for
 * why it is gated and where the rows come from).
 *
 * "Use" fills the form rather than making you copy two fields, which is the
 * actual job here -- checking each role quickly. Copy buttons stay for when
 * you want the value somewhere else. Clipboard access can be denied or absent
 * over plain HTTP, so every copy falls back to selecting the text instead of
 * silently doing nothing.
 */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Non-secure context, or the user denied permission. Say so rather than
      // showing a "Copied" that never happened.
      window.prompt(`Copy ${label}:`, value);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className={cx(
        'rounded-ck border border-line px-2 py-0.5 text-xs font-medium transition-colors',
        copied ? 'border-transparent bg-success-soft text-success' : 'text-muted hover:bg-sunken hover:text-ink',
      )}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function AccountRow({
  account,
  password,
  onUse,
}: {
  account: DemoAccount;
  password: string | null;
  onUse: (account: DemoAccount) => void;
}) {
  return (
    <tr className="border-t border-line align-top">
      <td className="py-2 pr-3">
        <span className="font-medium whitespace-nowrap">{ROLE_LABELS[account.role]}</span>
        {account.note ? <p className="mt-0.5 text-xs text-subtle">{account.note}</p> : null}
      </td>

      <td className="py-2 pr-3">
        <span className="font-mono text-xs break-all">{account.email}</span>
      </td>

      <td className="py-2">
        <div className="flex items-center justify-end gap-1.5">
          <CopyButton value={account.email} label="email" />
          {password ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => onUse(account)}>
              Use
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function DemoAccounts({
  accounts,
  onUse,
}: {
  accounts: DemoAccountList;
  onUse: (account: DemoAccount) => void;
}) {
  const { onePerRole, all, password } = accounts;
  const alternates = all.filter((account) => !onePerRole.includes(account));

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Demo accounts</h2>
        <Badge tone="warning">Development only</Badge>
      </div>

      <p className="mt-1 text-sm text-muted">
        One account per role, read live from the database. “Use” fills the form on the left.
      </p>

      {password ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-ck border border-line bg-sunken px-3 py-2">
          <span className="text-xs text-subtle">Password (all accounts)</span>
          <span className="font-mono text-xs">{password}</span>
          <span className="ml-auto">
            <CopyButton value={password} label="password" />
          </span>
        </div>
      ) : (
        <p className="mt-4 rounded-ck border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
          Set <span className="font-mono">DEMO_ACCOUNT_PASSWORD</span> to enable one-click fill.
          The seed uses one shared password for every demo account.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Seeded accounts, one per role</caption>
          <thead>
            <tr className="text-left text-xs text-subtle">
              <th scope="col" className="pb-2 font-medium">
                Role
              </th>
              <th scope="col" className="pb-2 font-medium">
                Email
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {onePerRole.map((account) => (
              <AccountRow
                key={account.email}
                account={account}
                password={password}
                onUse={onUse}
              />
            ))}
          </tbody>
        </table>
      </div>

      {alternates.length > 0 ? (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">
            {alternates.length} more seeded account(s)
          </summary>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {alternates.map((account) => (
                  <AccountRow
                    key={account.email}
                    account={{ ...account, note: account.fullName }}
                    password={password}
                    onUse={onUse}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      <p className="mt-4 text-xs text-subtle">
        This panel only renders while <span className="font-mono">SHOW_DEMO_ACCOUNTS=true</span>.
        Remove that variable before the storefront is real.
      </p>
    </Card>
  );
}
