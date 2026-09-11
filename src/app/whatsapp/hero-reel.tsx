import Image from 'next/image';
import type { CSSProperties } from 'react';
import { cx } from '@/components/ui/button-styles';
import idliVada from '@/images/hero/idli-vada.jpg';
import pooriChole from '@/images/hero/poori-chole.jpg';
import masalaDosa from '@/images/hero/masala-dosa.jpg';
import riceBath from '@/images/hero/rice-bath.jpg';

/**
 * Four dishes on a loop in the hero. Motion lives in `reel.css`.
 *
 * Ordered warm / dark / warm / bright rather than in the order they arrived.
 * Consecutive slides that share a palette make the wipe look like a glitch in
 * one photograph instead of a change of dish, and the edge is the only thing
 * telling the eye a swap happened at this speed.
 *
 * Imported rather than referenced by path out of `public`, and that is worth a
 * note because it fixes two real problems.
 *
 * The URL is content-hashed. A file replaced at the same public path keeps the
 * same URL, so every cache between the image and the eye -- the browser's, the
 * optimizer's on-disk cache, a CDN's -- is entitled to keep serving the old
 * bytes, and swapping a photograph looks like nothing happened. An import
 * changes the filename whenever the file changes, so a stale copy has no way
 * to be requested.
 *
 * The dimensions come with it. They used to be typed out beside each path, and
 * a hand-maintained width on an image somebody else will replace is a wrong
 * aspect ratio waiting to happen -- swap a portrait for a landscape and the
 * layout reserves the wrong box until the picture lands.
 */
const SHOTS = [idliVada, pooriChole, masalaDosa, riceBath];

export function HeroReel({ className }: { className?: string }) {
  return (
    /* One `role="img"` over the set, and `alt=""` on every slide inside it.
       Four photographs that replace each other every 0.75s are one illustration
       of what the kitchen cooks, not four separate pieces of information, and
       captioning each would have a screen reader announce a new dish twice a
       second for as long as the page is open. */
    <div
      className={cx('hero-reel aspect-[4/3] w-full', className)}
      role="img"
      aria-label="Dishes from the kitchen: idli and vada, poori with chole, masala dosa, and tomato rice bath"
    >
      {SHOTS.map((shot, index) => (
        <div
          key={shot.src}
          className="hero-slide"
          style={{ '--i': index } as CSSProperties}
        >
          {/* No `width`/`height`: a static import carries its own, so the
              reserved box always matches the file that is actually there. */}
          <Image
            src={shot}
            alt=""
            /* The frame is the full column on a phone and 22rem from `md` up.
               Getting this wrong here is four full-size photographs on a phone
               connection rather than four thumbnails. */
            sizes="(max-width: 767px) calc(100vw - 2rem), 352px"
            /* Only the first is on the critical path. It is what the visitor
               sees at 0ms and the hero's LCP candidate; the other three have
               0.75s, 1.5s and 2.25s of runway and are in the viewport anyway,
               so they fetch without being asked to jump the queue. */
            /* `fetchPriority` rather than Next 16's `preload`: a preload link fetches at the browser's default image priority,
               which is low, and this is the one request on the page that must
               not wait behind anything. */
            loading={index === 0 ? 'eager' : undefined}
            fetchPriority={index === 0 ? 'high' : undefined}
            className="hero-shot"
          />
        </div>
      ))}

      <span aria-hidden className="hero-seam" />
    </div>
  );
}
