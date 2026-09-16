'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckIcon, CloseIcon } from '@/components/site/icons';
import { useMotion, warmMotion } from './account-motion';

type Preview = { from: string; to: string } | null;

type StageActions = {
  setPreview: (preview: Preview) => void;
  /** A confirmed outcome, announced once and shown briefly at the foot of the screen. */
  announce: (message: string) => void;
};

/*
 * Two contexts, split by how often they change. The functions never change;
 * the preview changes on every date typed into the pause form. Held in one
 * context, every skip control on the page -- which only ever needs `announce`
 * -- re-rendered on each of those keystrokes. Split, only the calendar does.
 */
const ActionsContext = createContext<StageActions>({ setPreview: () => {}, announce: () => {} });
const PreviewContext = createContext<Preview>(null);

export function useStage(): StageActions {
  return useContext(ActionsContext);
}

/** The range the pause form is describing, so the calendar can show it. */
export function usePreview(): Preview {
  return useContext(PreviewContext);
}

/**
 * The account overview's client shell.
 *
 * Three jobs, none of which the server-rendered page can do on its own:
 *
 * - **The pause preview.** The pause form lives in the plan ticket and the
 *   calendar lives in the main column; the range being typed into one is drawn
 *   on the other. This holds that range between them.
 * - **The outcome.** A successful skip re-renders the row that asked for it --
 *   the button that was pressed is gone by the time the answer arrives -- so
 *   the confirmation has to live somewhere that outlasts the control. It is a
 *   polite status message at the foot of the screen, and it is never the only
 *   signal: the calendar and the list have already changed.
 * - **Loading GSAP on intent.** See `account-motion.ts`.
 */
export function AccountStage({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState<Preview>(null);
  const [notice, setNotice] = useState<{ message: string; key: number } | null>(null);

  const announce = useCallback((message: string) => {
    setNotice({ message, key: Date.now() });
  }, []);

  // Stable, or every preview keystroke would re-run the notice's effect and
  // replay its entrance.
  const dismiss = useCallback(() => setNotice(null), []);

  // Pointer-over fires constantly; after the first call this is a resolved
  // promise lookup and nothing more.
  const warm = useCallback(() => void warmMotion(), []);

  // Idle as a fallback for a visitor who reads before touching anything; the
  // pointer and focus handlers below usually get there first.
  useEffect(() => {
    // Safari has no `requestIdleCallback`; a plain timer is the fallback there.
    if (typeof window.requestIdleCallback === 'function') {
      const idle = window.requestIdleCallback(() => void warmMotion(), { timeout: 4000 });
      return () => window.cancelIdleCallback(idle);
    }
    const timer = setTimeout(() => void warmMotion(), 2500);
    return () => clearTimeout(timer);
  }, []);

  const actions = useMemo(() => ({ setPreview, announce }), [announce]);

  return (
    <ActionsContext.Provider value={actions}>
      <PreviewContext.Provider value={preview}>
        <div
          className="acct"
          onPointerOver={warm}
          onFocusCapture={warm}
          onTouchStart={warm}
        >
          {children}
        </div>
      </PreviewContext.Provider>
      <Notice notice={notice} onDismiss={dismiss} />
    </ActionsContext.Provider>
  );
}

/**
 * The confirmation. Five seconds, paused while it is pointed at or focused,
 * with a way to close it. The live region itself is always in the DOM, so the
 * first message is announced rather than lost to a region that appeared with it.
 */
function Notice({
  notice,
  onDismiss,
}: {
  notice: { message: string; key: number } | null;
  onDismiss: () => void;
}) {
  const { scope, animate } = useMotion<HTMLDivElement>();
  const held = useRef(false);

  useEffect(() => {
    if (!notice) return;

    animate((gsap, root) => {
      gsap.fromTo(
        root.querySelector('.acct-notice-card'),
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.32, ease: 'ck' },
      );
    });

    const timer = window.setInterval(() => {
      if (!held.current) onDismiss();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [notice, animate, onDismiss]);

  return (
    <div ref={scope} className="acct-notice" role="status" aria-live="polite">
      {notice ? (
        <div
          key={notice.key}
          className="acct-notice-card"
          onPointerEnter={() => (held.current = true)}
          onPointerLeave={() => (held.current = false)}
          onFocus={() => (held.current = true)}
          onBlur={() => (held.current = false)}
        >
          <CheckIcon className="acct-notice-icon" />
          <p>{notice.message}</p>
          <button type="button" className="acct-notice-close" onClick={onDismiss}>
            <CloseIcon />
            <span className="sr-only">Dismiss</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
