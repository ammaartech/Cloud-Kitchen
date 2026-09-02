'use client';

import { useRef } from 'react';
import { useInView } from 'motion/react';
import { cx } from '@/components/ui/button-styles';

/**
 * The "How a subscription works" sequence: a heading that types itself, and
 * four steps that deal out of a single stack.
 *
 * Both effects run on CSS keyframes. The only JavaScript is `useInView`, which
 * adds one class when the section reaches the viewport -- and it is genuinely
 * needed, because this section sits well below the fold. An entrance that
 * finishes before anyone scrolls to it is an entrance nobody sees, and CSS
 * cannot yet trigger on viewport intersection anywhere but Chromium.
 *
 * `useInView` is a bare `IntersectionObserver` hook. It does not need the
 * `LazyMotion` feature bundle and is already in the chunk the hero pulls in, so
 * this section costs no library bytes beyond the components themselves.
 *
 * The failure modes decide the base rules, as everywhere else in this file's
 * neighbourhood: with no class applied, the heading is fully typed and the four
 * steps are sitting in their columns. Every hidden state lives inside a
 * keyframe, so a visitor whose JavaScript never arrives gets the finished
 * picture rather than a blank one.
 */

/**
 * Milliseconds per character. Fast enough not to be a wait, slow enough to read
 * as typing -- and nearer the second than it was: at 34ms the whole heading was
 * down in well under a second, which is quick enough that it registered as a
 * flicker on the way to being text rather than as something being written.
 */
const CHAR_STEP = 46;
/**
 * Milliseconds between one number setting off and the next.
 *
 * Most of the glide, not a fraction of it. A relay only reads as a relay if you
 * can see the hand-off: a number has to be nearly home before the next comes
 * out from behind it, or all three are in the air at once and it turns back
 * into four things moving at the same time. The small remaining overlap is what
 * keeps it from feeling like four animations played in a queue -- the next is
 * already easing away as the last one settles.
 *
 * Paced with the glide below it in `globals.css`: raise one and the other has
 * to follow, or the overlap this number exists to control moves on its own.
 */
const STEP_STEP = 720;

type Step = { title: string; body: string };

/**
 * A heading that types itself out.
 *
 * Two copies of the same words, which is the same arrangement the hero
 * headline uses and for the same reason. The `sr-only` copy is the real
 * heading: one uninterrupted string, so a screen reader announces "How a
 * subscription works" rather than spelling out twenty-four separate letter
 * elements. The visible copy is split per character, and is `aria-hidden`
 * precisely because that split is a presentation detail.
 *
 * The split is per word first and per character second, and the outer level is
 * what keeps the heading readable. A run of individually wrapped characters
 * offers the browser a break opportunity between every pair of them, which
 * wraps this heading mid-word on a narrow screen; holding each word together
 * puts the break opportunities back where they belong, at the spaces.
 */
export function Typewriter({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // `once`, because this is an introduction and not a state readout. Retyping
  // the heading every time it scrolls back into view would make the section
  // feel unfinished rather than alive.
  const seen = useInView(ref, { once: true, amount: 0.6 });

  const words = text.split(' ');
  // The reveal runs across the whole line, so each character is delayed by its
  // position in the heading rather than its position in its own word.
  let index = 0;
  // Counted over the words rather than taken from `text.length`: the spaces
  // between them are rendered as plain text and never get a slot of their own,
  // so the string's length overstates how long the type-out actually runs. The
  // caret waits exactly this long before it starts blinking.
  const typedLength = words.reduce((total, word) => total + word.length, 0);

  return (
    <>
      <span className="sr-only">{text}</span>

      <span
        ref={ref}
        aria-hidden
        className={cx('typewriter', seen && 'is-typing', className)}
        style={
          {
            '--type-step': `${CHAR_STEP}ms`,
            '--caret-at': `${typedLength * CHAR_STEP}ms`,
          } as React.CSSProperties
        }
      >
        {words.map((word, wordIndex) => (
          <span key={`${word}-${wordIndex}`}>
            {wordIndex > 0 ? ' ' : null}
            <span className="type-word">
              {Array.from(word).map((character, characterIndex) => {
                const at = index++;
                return (
                  <span
                    key={`${character}-${characterIndex}`}
                    className="type-char"
                    style={{ '--char-at': `${at * CHAR_STEP}ms` } as React.CSSProperties}
                  >
                    {character}
                  </span>
                );
              })}
            </span>
          </span>
        ))}

        {/* Sits at the end of the line rather than travelling with the reveal.
            See the note above `.type-caret` in `globals.css` for what the
            travelling version actually did. */}
        <span className="type-caret" />
      </span>
    </>
  );
}

/**
 * The four steps, with the number handed along the row.
 *
 * Each number comes out from under the one before it: 2 out of 1's place, 3 out
 * of 2's, 4 out of 3's, and done. It is the gesture the section is already
 * describing in words -- each step follows from the last -- and it does the job
 * the arrows used to do without drawing anything.
 *
 * Only the number travels. The heading and the body never move; they fade up in
 * place as their number arrives. Sliding a heading and three lines of body copy
 * across a column asks the reader to track text they cannot read yet, four
 * times over, and the movement was never carrying information the numbered
 * badge was not already carrying on its own. See the note in `globals.css` for
 * the full version of that argument.
 *
 * This replaced four drawn arrows. They were reading as diagram furniture --
 * marks in the gutters that had to be explained rather than seen, and that had
 * to be suppressed at every breakpoint where the next step was not actually to
 * the right.
 *
 * The travel is the stylesheet's business; the numbers here are the ones it
 * cannot work out for itself. `--step-at` is when a number sets off, and
 * `--step-index` its place in the row, which is the order they have to overlap
 * in while one is still behind another.
 *
 * `--hop-sm` and `--hop-lg` are the only thing that differs between the steps,
 * and they are a flag rather than a distance: every number travels exactly one
 * column, so the question is only whether it has a predecessor in its own row
 * to come out of. Across four columns that is 0,1,1,1. Across two it is
 * 0,1,0,1 -- the third step opens a second row, so it is the start of a relay
 * rather than a link in one, and it settles in place the way the first step
 * does. The single-column layout needs no flag at all: there is nowhere to
 * travel to, so all four settle where they are.
 *
 * The step itself is centred on its number. The badge is the thing the eye
 * counts along this row, so it wants to sit on the column's axis rather than
 * against its left edge -- and once it does, the title and the body have to
 * follow it or the number reads as belonging to the step before. The body is
 * held to `max-w-xs` because centred text is only readable in short measures:
 * left-aligned prose can run as wide as the column, centred prose cannot.
 */
export function StepFlow({ steps }: { steps: Step[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.25 });

  return (
    <ol
      ref={ref}
      className={cx(
        'step-flow mt-12 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4',
        seen && 'is-revealed',
      )}
    >
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="text-center"
          style={
            {
              '--step-at': `${index * STEP_STEP}ms`,
              '--step-index': index,
              '--hop-sm': index % 2,
              '--hop-lg': index === 0 ? 0 : 1,
            } as React.CSSProperties
          }
        >
          {/* The wrapper is what moves, and it exists because of how a
              percentage in a translate is measured: against the element being
              transformed. On the badge that would be 36px and land it nowhere;
              on a block spanning the column it is exactly one column, which is
              the distance to the number before it at every breakpoint. */}
          <span className="step-hop block">
            <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
              {index + 1}
            </span>
          </span>
          <h3 className="step-copy mt-4 text-lg font-semibold text-pretty">{step.title}</h3>
          <p className="step-copy mx-auto mt-1.5 max-w-xs text-sm text-muted text-pretty">
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  );
}
