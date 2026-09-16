'use client';

import { useRef, type MouseEvent, type ReactNode } from 'react';

/**
 * One question on `/about`, opening and closing with its height animated.
 *
 * A native `<details>` underneath, and that is the part not to replace. The
 * question is a real disclosure control to assistive tech without a line of
 * ARIA, the answer is in the HTML for search engines and for a visitor with no
 * JavaScript, and find-in-page opens the right answer on its own -- none of
 * which a `<button>` and a `useState` get for free.
 *
 * What the element cannot do is move. It swaps between closed and open in one
 * frame, and the obvious CSS fix -- transitioning `::details-content` to
 * `height: auto` -- only runs in Chromium; everywhere else it snaps exactly as
 * before. So the click is intercepted and the panel is animated here with WAAPI
 * instead: measure the real height, animate to it, and only then let the
 * element's own state catch up. A close keeps `open` set until the panel has
 * finished folding away, because removing it first would hide the answer on
 * the first frame and leave nothing to animate.
 *
 * Interruptible, because an accordion gets double-clicked. Every run starts
 * from wherever the panel is at that moment -- read off the element before the
 * previous animation is cancelled -- so reversing halfway turns around in place
 * instead of jumping to one end and starting over.
 *
 * `data-state` is where the element is *heading*, set on the click rather than
 * at the end, and it is what the icon is drawn from. `open` is still true for
 * the whole of a close, so an icon keyed on it would stay a minus until the
 * panel had already gone.
 */
export function FaqItem({
  number,
  question,
  children,
}: {
  number: string;
  question: string;
  children: ReactNode;
}) {
  const item = useRef<HTMLDetailsElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const running = useRef<Animation | null>(null);

  function toggle(event: MouseEvent<HTMLElement>) {
    const details = item.current;
    const body = panel.current;
    if (!details || !body) return;

    // Reduced motion gets the element's own instant toggle, untouched. The
    // `toggle` listener below still keeps the icon in step.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    event.preventDefault();

    const opening = details.dataset.state !== 'open';

    // Where the panel is right now, mid-flight included. Read before the
    // cancel, which would snap it back to its resting size.
    const fromHeight = details.open ? body.getBoundingClientRect().height : 0;
    const fromOpacity = details.open ? Number(getComputedStyle(body).opacity) : 0;
    running.current?.cancel();

    details.dataset.state = opening ? 'open' : 'closed';
    details.open = true;
    const toHeight = opening ? body.getBoundingClientRect().height : 0;

    // The page's own curve, read from the token rather than copied into a
    // string here, so the answers open on the same deceleration as everything
    // else on the storefront.
    const easing =
      getComputedStyle(document.documentElement).getPropertyValue('--ck-ease').trim() ||
      'ease-out';

    const animation = body.animate(
      [
        { height: `${fromHeight}px`, opacity: fromOpacity },
        { height: `${toHeight}px`, opacity: opening ? 1 : 0 },
      ],
      // Out faster than in: the visitor has read it and is moving on.
      { duration: opening ? 300 : 220, easing, fill: 'forwards' },
    );
    running.current = animation;

    // `fill: 'forwards'` holds the final frame until the element's state has
    // caught up, then the cancel hands the panel back to its natural size. A
    // close without the fill would show the full answer for a frame between
    // the animation ending and `open` coming off.
    animation.onfinish = () => {
      running.current = null;
      if (!opening) details.open = false;
      animation.cancel();
    };
  }

  return (
    <details
      ref={item}
      className="faq-item"
      data-rise
      // Anything that toggles the element without going through the click --
      // find-in-page, or the reduced-motion path above -- lands here. Ignored
      // while an animation is running, which has already set the state it is
      // heading for.
      onToggle={(event) => {
        if (running.current) return;
        event.currentTarget.dataset.state = event.currentTarget.open ? 'open' : 'closed';
      }}
    >
      <summary className="faq-question" onClick={toggle}>
        {/* The hairline lives in the summary because it is the only child a
            closed `<details>` renders. Anywhere else it would vanish along
            with the answer. */}
        <span className="story-rule-line" data-rule aria-hidden />
        <span className="faq-row">
          <span className="faq-no tabular" aria-hidden>
            {number}
          </span>
          <span className="faq-title">{question}</span>
          <span className="faq-icon" aria-hidden />
        </span>
      </summary>

      <div ref={panel} className="faq-panel">
        <div className="faq-answer">{children}</div>
      </div>
    </details>
  );
}
