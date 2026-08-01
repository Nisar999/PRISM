import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Animated "SHAPES" accent — cycles typography styles (presentation only).
 * Fonts already loaded in index.html (Instrument / Manrope / Afacad / Poller / ADLaM).
 */
const SHAPES_STYLES: { fontFamily: string; fontStyle: string; fontWeight: number }[] = [
  { fontFamily: 'Instrument Serif', fontStyle: 'italic', fontWeight: 400 },
  { fontFamily: 'Manrope', fontStyle: 'normal', fontWeight: 700 },
  { fontFamily: 'Afacad Flux', fontStyle: 'normal', fontWeight: 700 },
  { fontFamily: 'Poller One', fontStyle: 'normal', fontWeight: 400 },
  { fontFamily: 'ADLaM Display', fontStyle: 'normal', fontWeight: 400 },
];

const CYCLE_MS = 2200;

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
      }, 280);
    }, CYCLE_MS);
    return () => {
      window.clearInterval(tick);
      if (fadeOut) window.clearTimeout(fadeOut);
    };
  }, []);

  const style = SHAPES_STYLES[index] ?? SHAPES_STYLES[0];

  return (
    <span
      className={cn(
        'inline-block transition-opacity duration-[280ms] ease-in-out',
        visible ? 'opacity-100' : 'opacity-0',
        className,
      )}
      style={{
        fontFamily: `"${style.fontFamily}", serif`,
        fontStyle: style.fontStyle,
        fontWeight: style.fontWeight,
      }}
    >
      SHAPES
    </span>
  );
}
