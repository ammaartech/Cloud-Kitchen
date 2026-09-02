/**
 * The DOM feature bundle for `LazyMotion`, in its own module so it can be
 * reached by a dynamic `import()` and therefore split out of the entry chunk.
 *
 * This project's whole case for the home page is that it arrives fast, so the
 * ~8 KB gzipped of DOM feature code is kept out of the module graph that the
 * hero's own components sit in, and reached through `LazyMotion` instead.
 *
 * Be clear about what that does and does not buy, because the obvious reading
 * is too generous. Next still lists this chunk on the route, so it is still
 * requested on the first visit -- what the split changes is that it arrives as
 * a separate `async` script that blocks neither parsing nor paint, and that
 * the hero's markup is complete and correct before it lands. The entrance
 * animation is CSS and has already run by then; the pointer and scroll layer
 * this bundle powers cannot be needed any earlier, because there has been no
 * pointer and no scroll.
 */
export { domAnimation as default } from 'motion/react';
