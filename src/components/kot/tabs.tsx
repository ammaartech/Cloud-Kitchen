'use client';

import { cx } from '@/components/ui/primitives';

export type KotTabKey = 'live' | 'completed' | 'all';

const TABS: Array<{ key: KotTabKey; label: string }> = [
  { key: 'live', label: 'Live KOT' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All Orders' },
];

export function KotTabs({
  active,
  onChange,
}: {
  active: KotTabKey;
  onChange: (next: KotTabKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="KOT view"
      className="flex w-full rounded-ck-lg border border-line bg-sunken p-1"
    >
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            className={cx(
              'flex-1 rounded-ck px-4 py-2 text-center text-sm font-medium transition-colors duration-150 ease-ck',
              selected
                ? 'bg-surface text-ink shadow-ck-sm'
                : 'text-muted hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
