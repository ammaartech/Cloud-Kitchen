import type { CSSProperties, ReactNode } from 'react';

/**
 * The pieces every account page is built from, so the four of them read as one
 * place rather than one designed dashboard and three admin forms.
 *
 * Server components, and static: part of the shell the router prefetches and
 * paints the instant a tab is pressed. The skeletons that stand in for each
 * page's rows live in `account-skeletons.tsx`.
 */

/** The page's heading: a small line of context, the title, one sentence. */
export function AccountHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="acct-head acct-enter" style={{ '--i': 0 } as CSSProperties}>
      <p className="acct-date">{eyebrow}</p>
      <h1 className="acct-hello">{title}</h1>
      {children ? <p className="acct-summary">{children}</p> : null}
    </header>
  );
}

/**
 * One block of content arriving. `index` places it in the page's stagger, so
 * a page lands top to bottom in one short run instead of all at once.
 *
 * CSS only (`.acct-enter` in `account.css`): it runs when the block mounts --
 * which is when its data arrives -- and never again for a re-render, so a skip
 * or a pause re-rendering the page does not replay the entrance.
 */
export function Enter({
  index,
  as: Tag = 'div',
  className,
  children,
}: {
  index: number;
  as?: 'div' | 'section';
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={className ? `acct-enter ${className}` : 'acct-enter'} style={{ '--i': index } as CSSProperties}>
      {children}
    </Tag>
  );
}
