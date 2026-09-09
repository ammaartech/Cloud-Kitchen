'use client';

import Image from 'next/image';
import { useRef, useCallback } from 'react';
import { useIsomorphicLayoutEffect } from 'motion/react';
import type { Photo } from './photos';
import {
  GRAVITY,
  SUBSTEP,
  integrate,
  lerp,
  relax,
  ropePath,
  type Link,
  type Node,
} from './rope-physics';

const ROPE_NODES = 10;

const HANG = ROPE_NODES - 1;

const ARM = ROPE_NODES;

const ROPE_W = 1;
const PICTURE_W = 0.125;

const ROPE_STIFFNESS = 0.9;
const ARM_STIFFNESS = 1;

const PIN_INSET = 6;

const RELEASE_STEP = 130;

const LEAN = [-11, 9, -7];

const CUT_FADE = 260;
const RESPAWN = 420;

const BLADE_POINTS = 8;
const BLADE_LIFE = 180;

const MAX_STEPS = 12;

type Grab = {
  
  x: number;
  y: number;
  
  offX: number;
  offY: number;
  
  fromX: number;
  fromY: number;
};

type Rig = {
  nodes: Node[];
  links: Link[];
  segment: number;
  arm: number;
  anchorX: number;
  restX: number;
  restY: number;
  
  releaseAt: number;
  live: boolean;
  
  cut: number;
  
  fade: number;
  
  
  shown: number;
  shownRope: number;
  shownTail: number;
  pinned: number;
  
  grab: Grab | null;
  
  gone: number;
};

export function HangingPhotos({ photos }: { photos: Photo[] }) {
  const photoKey = photos.map((photo) => photo.id).join('|');
  const artRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const shotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const tailRefs = useRef<(SVGPathElement | null)[]>([]);
  const pinRefs = useRef<(SVGCircleElement | null)[]>([]);
  const bladeRef = useRef<SVGPathElement>(null);

  const setShot = useCallback((index: number) => {
    return (element: HTMLDivElement | null) => {
      shotRefs.current[index] = element;
    };
  }, []);

  useIsomorphicLayoutEffect(() => {
    const art = artRef.current;
    const svg = svgRef.current;
    if (!art || !svg) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    const rigs: Rig[] = [];
    const rise = -PIN_INSET;
    
    let layoutWidth = 0;
    let layoutHeight = 0;
    let raf = 0;
    let running = false;
    let near = false;
    let dropped = false;
    let startedAt = 0;
    let previous = 0;
    let carry = 0;

    const blade: { x: number; y: number; at: number }[] = [];
    
    let gesture: 'none' | 'blade' | 'drag' = 'none';
    let gesturePointer = -1;
    let gestureIndex = -1;

    let bladeShown = -1;
    
    let artLeft = 0;
    let artTop = 0;

    function measure(rebuild: boolean) {
      const artBox = art!.getBoundingClientRect();
      artLeft = artBox.left;
      artTop = artBox.top;
      if (!rebuild && layoutWidth === artBox.width && layoutHeight === artBox.height) return;
      layoutWidth = artBox.width;
      layoutHeight = artBox.height;

      // Pins, ropes and photos share one local coordinate system.
      svg!.setAttribute('viewBox', `0 0 ${artBox.width} ${artBox.height}`);

      shotRefs.current.forEach((shot, index) => {
        if (!shot) return;

        const restX = shot.offsetLeft + shot.offsetWidth / 2;
        const restY = shot.offsetTop;
        
        const arm = Math.min(shot.offsetHeight * 0.45, 140);

        if (rebuild || !rigs[index]) {
          rigs[index] = seed(index, restX, restY, arm);
          return;
        }

        // Reset previous positions too; moving only the pin invents velocity.
        rigs[index] = seed(index, restX, restY, arm);
        if (dropped || reduced.matches) settle(rigs[index]);
      });
    }

    function wound(restY: number) {
      return Math.max(0, restY + rise - 96);
    }

    function seed(index: number, restX: number, restY: number, arm: number): Rig {
      const rig: Rig = {
        nodes: [],
        links: [],
        segment: (restY + rise) / (ROPE_NODES - 1),
        arm,
        anchorX: restX,
        restX,
        restY,
        releaseAt: index * RELEASE_STEP,
        live: false,
        cut: -1,
        fade: 0,
        shown: -1,
        shownRope: -1,
        shownTail: -1,
        pinned: Number.NaN,
        grab: null,
        gone: 0,
      };

      for (let i = 0; i < ROPE_NODES; i++) {
        rig.links.push({
          a: i,
          b: i + 1,
          length: rig.segment,
          stiffness: ROPE_STIFFNESS,
          slack: true,
        });
      }
      
      rig.links[ROPE_NODES - 1] = { a: HANG, b: ARM, length: arm, stiffness: ARM_STIFFNESS };

      reset(rig, index);
      return rig;
    }

    function reset(rig: Rig, index: number) {
      const start = wound(rig.restY);
      const spacing = start / (ROPE_NODES - 1);
      const nudge = LEAN[index % LEAN.length] * 0.02;

      rig.nodes.length = 0;
      for (let i = 0; i < ROPE_NODES; i++) {
        const y = -rise + i * spacing;
        const w = i === 0 ? 0 : i === HANG ? PICTURE_W : ROPE_W;
        rig.nodes.push({
          x: rig.anchorX,
          y,
          px: w === 0 ? rig.anchorX : rig.anchorX - nudge,
          py: y,
          w,
        });
      }

      const hang = rig.nodes[HANG];
      rig.nodes.push({
        x: hang.x,
        y: hang.y + rig.arm,
        px: hang.x - nudge,
        py: hang.y + rig.arm,
        w: PICTURE_W,
      });

      rig.segment = (rig.restY + rise) / (ROPE_NODES - 1);
      for (let i = 0; i < ROPE_NODES - 1; i++) {
        rig.links[i].length = rig.segment;
        rig.links[i].stiffness = ROPE_STIFFNESS;
      }
      rig.links[ROPE_NODES - 1].length = rig.arm;

      rig.cut = -1;
      rig.fade = 0;
      rig.gone = 0;
      rig.grab = null;
    }

    function settle(rig: Rig) {
      for (let i = 0; i < ROPE_NODES - 1; i++) rig.links[i].stiffness = ROPE_STIFFNESS;
      for (let i = 0; i < ROPE_NODES; i++) {
        const node = rig.nodes[i];
        node.x = node.px = rig.anchorX;
        node.y = node.py = -rise + i * rig.segment;
      }
      const arm = rig.nodes[ARM];
      arm.x = arm.px = rig.anchorX;
      arm.y = arm.py = rig.restY + rig.arm;
      rig.live = true;
      rig.cut = -1;
      rig.fade = 0;
      rig.gone = 0;
      rig.grab = null;
    }

    function crosses(
      ax: number,
      ay: number,
      bx: number,
      by: number,
      cx: number,
      cy: number,
      dx: number,
      dy: number,
    ) {
      const side = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
        (qx - px) * (ry - py) - (qy - py) * (rx - px);

      const d1 = side(ax, ay, bx, by, cx, cy);
      const d2 = side(ax, ay, bx, by, dx, dy);
      const d3 = side(cx, cy, dx, dy, ax, ay);
      const d4 = side(cx, cy, dx, dy, bx, by);

      return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
    }

    function slice(ax: number, ay: number, bx: number, by: number) {
      for (const rig of rigs) {
        if (!rig.live || rig.cut >= 0 || rig.gone) continue;

        for (let i = 0; i < ROPE_NODES - 1; i++) {
          const p = rig.nodes[i];
          const q = rig.nodes[i + 1];
          if (!crosses(ax, ay, bx, by, p.x, p.y, q.x, q.y)) continue;

          rig.links[i].stiffness = 0;
          rig.cut = i;
          return true;
        }
      }

      return false;
    }

    function local(event: PointerEvent) {
      return { x: event.clientX - artLeft, y: event.clientY - artTop };
    }

    function shotUnder(target: EventTarget | null) {
      if (!(target instanceof Element)) return -1;
      for (let i = 0; i < shotRefs.current.length; i++) {
        const shot = shotRefs.current[i];
        if (shot && shot.contains(target)) return i;
      }
      return -1;
    }

    function onDown(event: PointerEvent) {
      if (reduced.matches || !near || gesturePointer >= 0) return;
      // A finger on the artwork always retains native page scrolling.
      if (event.pointerType !== 'mouse') return;
      if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea')) return;
      const box = art!.getBoundingClientRect();
      artLeft = box.left;
      artTop = box.top;
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) return;
      
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      const index = shotUnder(event.target);
      const rig = index >= 0 ? rigs[index] : undefined;
      const grippable = !!rig && rig.live && rig.cut < 0 && !rig.gone;

      gesturePointer = event.pointerId;
      gesture = grippable ? 'drag' : 'blade';
      gestureIndex = grippable ? index : -1;

      const at = local(event);

      blade.length = 0;
      begin(at.x, at.y);
    }

    function begin(x: number, y: number) {
      start();
      if (gesture === 'blade') {
        blade.push({ x, y, at: performance.now() });
        return;
      }

      const rig = rigs[gestureIndex];
      if (!rig) return;
      const node = rig.nodes[HANG];
      
      rig.grab = {
        x,
        y,
        offX: node.x - x,
        offY: node.y - y,
        fromX: node.x,
        fromY: node.y,
      };
      art!.classList.add('is-held');
    }

    function onMove(event: PointerEvent) {
      if (gesturePointer !== event.pointerId) return;
      const at = local(event);

      if (gesture === 'drag') {
        const rig = rigs[gestureIndex];
        if (rig?.grab) {
          rig.grab.x = at.x;
          rig.grab.y = at.y;
        }
        return;
      }

      const last = blade[blade.length - 1];
      if (last) slice(last.x, last.y, at.x, at.y);

      blade.push({ ...at, at: performance.now() });
      if (blade.length > BLADE_POINTS) blade.shift();
      start();
    }

    function onUp(event: PointerEvent) {
      if (gesturePointer !== event.pointerId) return;
      release();
    }

    function release() {
      if (gestureIndex >= 0) {
        const rig = rigs[gestureIndex];
        if (rig) rig.grab = null;
      }
      gesturePointer = -1;
      gestureIndex = -1;
      gesture = 'none';

      art!.classList.remove('is-held');
    }

    function draw(now: number, alpha: number) {
      for (let index = 0; index < rigs.length; index++) {
        const rig = rigs[index];
        if (!rig) continue;

        const shot = shotRefs.current[index];
        const path = pathRefs.current[index];
        const pin = pinRefs.current[index];
        const hang = rig.nodes[HANG];
        const arm = rig.nodes[ARM];

        const hx = lerp(hang.px, hang.x, alpha);
        const hy = lerp(hang.py, hang.y, alpha);

        if (shot) {
          const ax = lerp(arm.px, arm.x, alpha);
          const ay = lerp(arm.py, arm.y, alpha);
          const tilt = (-Math.atan2(ax - hx, ay - hy) * 180) / Math.PI;

          shot.style.transform =
            'translate3d(' +
            (hx - rig.restX).toFixed(2) +
            'px, ' +
            (hy - rig.restY).toFixed(2) +
            'px, 0) rotate(' +
            tilt.toFixed(3) +
            'deg)';

          const want = rig.live ? 1 - rig.fade : 0;
          if (want !== rig.shown) {
            shot.style.opacity = want.toFixed(3);
            rig.shown = want;
          }
        }

        const tail = tailRefs.current[index];

        if (path) {
          if (rig.cut < 0) path.setAttribute('d', ropePath(rig.nodes, 0, HANG, alpha));
          else path.setAttribute('d', rig.cut >= 1 ? ropePath(rig.nodes, 0, rig.cut, alpha) : '');
          const want = rig.live ? 1 : 0;
          if (want !== rig.shownRope) {
            path.style.opacity = String(want);
            rig.shownRope = want;
          }
        }

        if (tail) {
          const showing = rig.cut >= 0 && rig.cut + 1 < HANG;
          tail.setAttribute('d', showing ? ropePath(rig.nodes, rig.cut + 1, HANG, alpha) : '');
          const want = showing ? 1 - rig.fade : 0;
          if (want !== rig.shownTail) {
            tail.style.opacity = want.toFixed(3);
            rig.shownTail = want;
          }
        }

        if (pin && rig.pinned !== rig.anchorX) {
          pin.setAttribute('cx', rig.anchorX.toFixed(1));
          pin.setAttribute('cy', (-rise).toFixed(1));
          rig.pinned = rig.anchorX;
        }
      }

      const trail = bladeRef.current;
      if (trail) {
        
        const newest = blade.length ? blade[blade.length - 1].at : 0;
        const age = now - newest;
        const want = blade.length > 1 && age < BLADE_LIFE ? 1 - age / BLADE_LIFE : 0;

        if (want > 0) {
          let d = 'M ' + blade[0].x.toFixed(1) + ' ' + blade[0].y.toFixed(1);
          for (let i = 1; i < blade.length; i++) {
            d += ' L ' + blade[i].x.toFixed(1) + ' ' + blade[i].y.toFixed(1);
          }
          trail.setAttribute('d', d);
        }

        if (want !== bladeShown) {
          trail.style.opacity = want.toFixed(3);
          bladeShown = want;
        }
      }
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);

      if (previous === 0) previous = now;

      const elapsed = Math.min((now - previous) / 1000, 0.1);
      previous = now;

      if (gesturePointer >= 0) {
        const box = art!.getBoundingClientRect();
        artLeft = box.left;
        artTop = box.top;
      }

      const since = now - startedAt;

      for (let index = 0; index < rigs.length; index++) {
        const rig = rigs[index];

        if (!rig.live) {
          if (dropped && since >= rig.releaseAt) rig.live = true;
          else continue;
        }

        if (rig.gone) {
          if (now - rig.gone >= RESPAWN) {
            reset(rig, index);
            rig.live = true;
          }
          continue;
        }

        if (rig.cut >= 0) {
          
          rig.fade = Math.max(0, Math.min(1, (rig.nodes[HANG].y - rig.restY) / CUT_FADE));
          if (rig.fade >= 1) {
            rig.gone = now;
            continue;
          }
        }

      }

      carry += elapsed;
      let steps = Math.floor(carry / SUBSTEP);
      if (steps > MAX_STEPS) {
        steps = MAX_STEPS;
        carry = 0;
      } else {
        carry -= steps * SUBSTEP;
      }

      for (let step = 0; step < steps; step++) {
        
        const through = (step + 1) / steps;

        for (const rig of rigs) {
          if (!rig.live || rig.gone) continue;

          integrate(rig.nodes, GRAVITY);

          if (rig.grab) hold(rig, step / steps, through);

          relax(rig.nodes, rig.links);
        }
      }

      if (steps > 0) {
        for (const rig of rigs) {
          if (!rig.grab) continue;
          rig.grab.fromX = rig.grab.x + rig.grab.offX;
          rig.grab.fromY = rig.grab.y + rig.grab.offY;
        }
      }

      draw(now, carry / SUBSTEP);
      // Sleep once settled, and wake for a mouse interaction or a resize.
      if (
        dropped && since > 2400 && gesturePointer < 0 &&
        (!blade.length || now - blade[blade.length - 1].at > BLADE_LIFE) &&
        rigs.every((rig) => rig.live && rig.cut < 0 && !rig.gone &&
          rig.nodes.every((node) => Math.abs(node.x - node.px) + Math.abs(node.y - node.py) < 0.015))
      ) stop();
    }

    function hold(rig: Rig, was: number, now: number) {
      const grab = rig.grab!;
      const node = rig.nodes[HANG];
      const anchor = rig.nodes[0];
      const reach = rig.segment * (ROPE_NODES - 1);
      const destX = grab.x + grab.offX;
      const destY = grab.y + grab.offY;

      let ax = lerp(grab.fromX, destX, was);
      let ay = lerp(grab.fromY, destY, was);
      let bx = lerp(grab.fromX, destX, now);
      let by = lerp(grab.fromY, destY, now);

      const spanA = Math.sqrt((ax - anchor.x) ** 2 + (ay - anchor.y) ** 2);
      if (spanA > reach) {
        const scale = reach / spanA;
        ax = anchor.x + (ax - anchor.x) * scale;
        ay = anchor.y + (ay - anchor.y) * scale;
      }

      const spanB = Math.sqrt((bx - anchor.x) ** 2 + (by - anchor.y) ** 2);
      if (spanB > reach) {
        const scale = reach / spanB;
        bx = anchor.x + (bx - anchor.x) * scale;
        by = anchor.y + (by - anchor.y) * scale;
      }

      node.px = ax;
      node.py = ay;
      node.x = bx;
      node.y = by;
    }

    function start() {
      if (running || reduced.matches || !near || !dropped || document.hidden) return;
      running = true;
      carry = 0;
      previous = 0;
      art!.classList.add('is-live');
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      art!.classList.remove('is-live');
    }

    function freeze() {
      stop();
      release();
      blade.length = 0;
      measure(rigs.length === 0);
      for (const rig of rigs) settle(rig);
      draw(performance.now(), 1);
    }

    measure(true);

    if (reduced.matches) freeze();
    else draw(performance.now(), 1);

    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          near = entry.isIntersecting;
          if (near) start();
          else stop();
        }
      },
      { rootMargin: '200px 0px 200px 0px' },
    );

    const trigger = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || dropped) continue;
          dropped = true;
          startedAt = performance.now();
          trigger.disconnect();
          start();
        }
      },
      { threshold: 0.2 },
    );

    watcher.observe(art);
    trigger.observe(art);

    const resizer = new ResizeObserver(() => {
      if (reduced.matches) {
        freeze();
        return;
      }
      release();
      measure(false);
      start();
      if (!running) draw(performance.now(), 1);
    });

    const onPreference = () => {
      if (reduced.matches) freeze();
      else start();
    };

    const onVisibility = () => {
      if (document.hidden) { release(); stop(); }
      else start();
    };
    const onBlur = () => release();

    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    resizer.observe(art);
    reduced.addEventListener('change', onPreference);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);

    return () => {
      stop();
      watcher.disconnect();
      trigger.disconnect();
      resizer.disconnect();
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      reduced.removeEventListener('change', onPreference);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [photoKey]);

  return (
    
    <div ref={artRef} className="about-art is-hanging" aria-hidden>
      {photos.map((photo, index) => (
        <div key={photo.id} ref={setShot(index)} className="about-shot">
          <Image
            src={photo.imageUrl}
            alt=""
            width={800}
            height={1000}
            sizes="(max-width: 639px) 32vw, (max-width: 1023px) 28vw, 18vw"
            className="about-shot-img"
            draggable={false}
          />
        </div>
      ))}

      <svg ref={svgRef} className="hang-ropes" preserveAspectRatio="none" aria-hidden focusable="false">
        {photos.map((photo, index) => (
          <path
            key={photo.id}
            ref={(element) => {
              pathRefs.current[index] = element;
            }}
            className="hang-rope"
            d=""
          />
        ))}
        {photos.map((photo, index) => (
          <path
            key={`${photo.id}-tail`}
            ref={(element) => {
              tailRefs.current[index] = element;
            }}
            className="hang-rope"
            d=""
          />
        ))}
        {photos.map((photo, index) => (
          <circle
            key={photo.id}
            ref={(element) => {
              pinRefs.current[index] = element;
            }}
            className="hang-pin"
            r="2.5"
          />
        ))}
        <path ref={bladeRef} className="hang-blade" d="" />
      </svg>
    </div>
  );
}
