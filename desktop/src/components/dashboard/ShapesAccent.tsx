import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Animated "SHAPES" accent — cycles typography styles (presentation only).
 * Fonts already loaded in index.html (Instrument / Manrope / Afacad / Poller / ADLaM).
 *
 * Every style variant is rendered stacked in the same grid cell, so the accent
 * always occupies the width of the widest variant: the surrounding line never
 * wraps, jumps, or shifts when the font cycles.
 */
const SHAPES_STYLES: { fontFamily: string; fontStyle: string; fontWeight: number }[] = [
  { fontFamily: 'Instrument Serif', fontStyle: 'italic', fontWeight: 400 },
  { fontFamily: 'Manrope', fontStyle: 'normal', fontWeight: 700 },
  { fontFamily: 'Afacad Flux', fontStyle: 'normal', fontWeight: 700 },
  { fontFamily: 'Poller One', fontStyle: 'normal', fontWeight: 400 },
  { fontFamily: 'ADLaM Display', fontStyle: 'normal', fontWeight: 400 },
];

const CYCLE_MS = 2200;
const FADE_MS = 280;

export function ShapesAccent({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let fadeOut: number | undefined;
    const tick = window.setInterval(() => {
      setVisible(false);
      fadeOut = window.setTimeout(() => {
        setIndex((i) => (i + 1) % SHAPES_STYLES.length);
        setVisible(true);
      }, FADE_MS);
    }, CYCLE_MS);
    return () => {
      window.clearInterval(tick);
      if (fadeOut) window.clearTimeout(fadeOut);
    };
  }, []);

  return (
    <span className={cn('inline-grid whitespace-nowrap align-baseline', className)}>
      {SHAPES_STYLES.map((style, i) => (
        <span
          key={style.fontFamily}
          aria-hidden={i !== index}
          className={cn(
            'col-start-1 row-start-1 transition-opacity duration-[280ms] ease-in-out',
            i === index && visible ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            fontFamily: `"${style.fontFamily}", serif`,
            fontStyle: style.fontStyle,
            fontWeight: style.fontWeight,
          }}
        >
          SHAPES
        </span>
      ))}
    </span>
  );
}
