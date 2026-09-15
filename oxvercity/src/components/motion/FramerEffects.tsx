'use client';

/**
 * Replays Framer's own animation specs on the rebuilt markup.
 *
 * Four kinds, all recovered from the site rather than approximated:
 *
 * 1. Entrance animations (`data/appear.ts`): the JSON blob Framer ships per
 *    page, keyed by `data-framer-appear-id` and breakpoint. They run once on
 *    load, from the start state the server markup already carries inline.
 *    The hero titles also split into characters that rise one after another.
 * 2. Scroll reveals (`data/effects.ts` → appearEffects): the `__framer__enter`
 *    / `__framer__animate` props read out of the page bundles, keyed by the
 *    element's class. They run when the element crosses the viewport at the
 *    given threshold, and replay on exit when Framer's `animateOnce` is off.
 * 3. Scroll-linked transforms (`transformEffects` + `data/scrollTransforms.ts`):
 *    the hero zoom and the about page's image reveal, driven by scroll position
 *    through a spring.
 * 4. Loops (`loopEffects`): infinite rotations on the form spinners.
 *
 * It is applied imperatively over the markup rather than by wrapping every
 * section in a motion element: the sections are machine-generated from the
 * export, so keeping the animation layer outside them means a regeneration
 * never clobbers it. It re-runs on every navigation because the root layout
 * stays mounted across client-side routing.
 *
 * Reduced motion: every element is put straight into its resting state.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { animate, type AnimationPlaybackControls } from 'motion';
import { appearAnimations, TEXT_EFFECT } from '@/data/appear';
import { appearEffects, loopEffects, transformEffects, type EffectState, type EffectTransition } from '@/data/effects';
import { scrollTransforms } from '@/data/scrollTransforms';
import { activeBreakpointHash } from '@/lib/breakpoints';

type Target = Record<string, number>;
type Transition = Parameters<typeof animate>[2];

const TRANSFORM_KEYS = ['opacity', 'x', 'y', 'scale', 'rotate', 'rotateX', 'rotateY', 'skewX', 'skewY'] as const;

function toTarget(state: EffectState | null | undefined): Target {
  const target: Target = {};
  if (!state) return target;
  for (const key of TRANSFORM_KEYS) {
    const value = state[key];
    if (typeof value === 'number') target[key] = value;
  }
  return target;
}

/** Framer transition → Motion options. Spring and tween carry over unchanged. */
export function toTransition(transition: EffectTransition | null | undefined): Transition {
  if (!transition) return { type: 'spring', stiffness: 400, damping: 100, mass: 1 };
  if (transition.type === 'spring') {
    if (transition.bounce !== undefined && transition.duration !== undefined) {
      return { type: 'spring', bounce: transition.bounce, duration: transition.duration, delay: transition.delay ?? 0 };
    }
    return { type: 'spring', stiffness: transition.stiffness ?? 400, damping: transition.damping ?? 100, mass: transition.mass ?? 1, delay: transition.delay ?? 0 };
  }
  return { type: 'tween', duration: transition.duration ?? 0.4, ease: (transition.ease as [number, number, number, number] | undefined) ?? [0.44, 0, 0.56, 1], delay: transition.delay ?? 0 };
}

/** The resting state every effect animates to. */
function restingState(opacity: number, from: Target): Target {
  const target: Target = { opacity };
  for (const key of TRANSFORM_KEYS) {
    if (key === 'opacity') continue;
    if (key in from) target[key] = key === 'scale' ? 1 : 0;
  }
  return target;
}

const visible = (element: HTMLElement) => element.offsetParent !== null || getComputedStyle(element).position === 'fixed';

/** Document offset the way Framer measures it: the offsetTop chain. */
function documentTop(element: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && node !== document.documentElement) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

/**
 * Write x / y / scale into an element's inline transform, keeping whatever
 * else the template holds (the about images carry perspective and rotation).
 */
function transformWriter(element: HTMLElement) {
  const template = element.style.transform && element.style.transform !== 'none' ? element.style.transform : '';
  return (values: Target) => {
    let out = template;
    const put = (fn: string, value: string) => {
      const re = new RegExp(`${fn}\\([^)]*\\)`);
      if (re.test(out)) out = out.replace(re, `${fn}(${value})`);
      else out = `${out} ${fn}(${value})`.trim();
    };
    if ('x' in values) put('translateX', `${values.x}px`);
    if ('y' in values) put('translateY', `${values.y}px`);
    if ('scale' in values) put('scale', `${values.scale}`);
    element.style.transform = out || 'none';
    if ('opacity' in values) element.style.opacity = String(values.opacity);
  };
}

export function FramerEffects() {
  const pathname = usePathname();

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const running: AnimationPlaybackControls[] = [];
    const run = (element: HTMLElement, target: Target, transition: Transition) => {
      const controls = animate(element, target, reduced ? { duration: 0 } : transition);
      running.push(controls);
      return controls;
    };
    const hash = activeBreakpointHash();

    // ---- 1. entrance animations -------------------------------------------
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('[data-framer-appear-id]'))) {
      const id = element.dataset.framerAppearId ?? '';
      const specs = appearAnimations[id];
      if (!specs) continue;
      const spec = specs[hash] ?? specs.default;
      if (!spec) continue;
      const initial = toTarget(spec.initial);
      const { transition, ...rest } = spec.animate;
      animate(element, initial, { duration: 0 });
      void run(element, toTarget(rest), toTransition(transition)).finished.then(() => { element.style.willChange = ''; });

      // Split text: Framer's character effect on the hero titles.
      const letters = Array.from(element.querySelectorAll<HTMLElement>('span[style*="inline-block"]'));
      letters.forEach((letter, i) => {
        animate(letter, toTarget(TEXT_EFFECT.effect), { duration: 0 });
        run(letter, { opacity: 1, y: 0, x: 0, scale: 1, rotate: 0 }, { ...toTransition(TEXT_EFFECT.transition), delay: TEXT_EFFECT.startDelay + TEXT_EFFECT.stagger * i });
      });
    }

    // ---- 2. scroll reveals -------------------------------------------------
    const observers: IntersectionObserver[] = [];
    for (const [className, effect] of Object.entries(appearEffects)) {
      if (effect.scrollDirection || !effect.enter) continue;
      const elements = Array.from(document.querySelectorAll<HTMLElement>(`.${CSS.escape(className)}`)).filter((element) => !element.hasAttribute('data-framer-appear-id'));
      if (!elements.length) continue;
      const enter = toTarget(effect.enter);
      const resting = restingState(effect.targetOpacity, enter);
      const transition = toTransition(effect.transition);
      const exit = effect.exit ? toTarget(effect.exit) : null;
      const exitTransition = toTransition(effect.exit?.transition ?? effect.transition);

      if (reduced) {
        for (const element of elements) animate(element, resting, { duration: 0 });
        continue;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const element = entry.target as HTMLElement;
            if (entry.isIntersecting) {
              void run(element, resting, transition).finished.then(() => { element.style.willChange = ''; });
              if (effect.once) observer.unobserve(element);
            } else if (exit && !effect.once) {
              run(element, exit, exitTransition);
            }
          }
        },
        { threshold: effect.threshold },
      );
      for (const element of elements) observer.observe(element);
      observers.push(observer);
    }

    // ---- 3. scroll-linked transforms ---------------------------------------
    const scrollHandlers: (() => void)[] = [];
    for (const binding of scrollTransforms) {
      const effect = transformEffects[binding.className];
      const targets = effect?.targets;
      if (!targets || targets.length < 2 || !targets[0].target || !targets[1].target) continue;
      const ref = document.querySelector<HTMLElement>(binding.ref);
      if (!ref) continue;
      const from = toTarget(targets[0].target);
      const to = toTarget(targets[1].target);
      const keys = Object.keys(to).filter((k) => from[k] !== to[k]);
      if (!keys.length) continue;
      const spring = toTransition(effect.spring);
      for (const element of Array.from(document.querySelectorAll<HTMLElement>(`.${CSS.escape(binding.className)}`))) {
        if (!visible(element)) continue;
        const write = transformWriter(element);
        let progress = 0;
        let shown = 0;
        let controls: AnimationPlaybackControls | undefined;
        const apply = (p: number) => {
          const values: Target = {};
          for (const key of keys) values[key] = from[key] + (to[key] - from[key]) * p;
          write(values);
        };
        const onScroll = () => {
          // Framer's range: the reference's top minus the threshold line, spanning
          // its height; the start is clamped to the page top but the end is not.
          const from = documentTop(ref) + (binding.offset ?? 0) - 1 - effect.threshold * window.innerHeight;
          const start = Math.max(from, 0);
          const end = Math.max(from + (binding.length ?? ref.clientHeight), start + 1);
          const raw = Math.min(Math.max((window.scrollY - start) / (end - start), 0), 1);
          const next = binding.curve === 'half' ? raw / (1 + raw) : raw;
          if (next === progress) return;
          progress = next;
          controls?.stop();
          if (reduced) { shown = next; apply(shown); return; }
          controls = animate(shown, next, { ...spring, onUpdate: (v: number) => { shown = v; apply(shown); } } as Transition);
          running.push(controls);
        };
        apply(0);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        scrollHandlers.push(() => window.removeEventListener('scroll', onScroll));
      }
    }

    // ---- 4. loops ------------------------------------------------------------
    for (const [className, effect] of Object.entries(loopEffects)) {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>(`.${CSS.escape(className)}`))) {
        if (reduced) continue;
        running.push(animate(element, toTarget(effect.loop), { ...toTransition(effect.transition), repeat: Infinity, repeatType: effect.repeatType === 'reverse' ? 'reverse' : effect.repeatType === 'mirror' ? 'mirror' : 'loop', repeatDelay: effect.repeatDelay }));
      }
    }

    return () => {
      for (const observer of observers) observer.disconnect();
      for (const off of scrollHandlers) off();
      for (const controls of running) controls.stop();
    };
  }, [pathname]);

  return null;
}
