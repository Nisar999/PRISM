import { cn } from '@/lib/utils';

/**
 * Chromatic-aberration wordmark — Figma Opening Page PRISM stack (node 479:120).
 * Layered cyan / green / red blur + hard-light white.
 * Coordinates are relative to the Figma group origin (302, 293).
 */
export interface ChromaticWordmarkProps {
  text?: string;
  className?: string;
  /** Design-space font size in px (Figma: 325.929). */
  fontSize?: number;
}

export function ChromaticWordmark({
  text = 'PRISM',
  className,
  fontSize = 325.929,
}: ChromaticWordmarkProps) {
  const layerBase =
    "absolute flex h-[224.076px] w-[831.797px] -translate-y-1/2 flex-col justify-center font-afacad font-bold leading-none";

  return (
    <div
      className={cn('pointer-events-none relative h-[224px] w-[832px]', className)}
      aria-label={text}
      role="img"
    >
      {/* Figma tops are vertical centers; group top = 293 → local = top - 293 */}
      <div
        className={cn(
          layerBase,
          'left-[1.64px] top-[123.49px] blur-[3.271px] text-[#0bf]',
          'animate-[opening-chroma-drift_4.5s_ease-in-out_infinite]',
        )}
        style={{ fontSize }}
        aria-hidden
      >
        <p>{text}</p>
      </div>
      <div
        className={cn(
          layerBase,
          'left-0 top-[118.58px] blur-[3.271px] text-[#1eff00]',
          'animate-[opening-chroma-drift_4.5s_ease-in-out_infinite_reverse]',
        )}
        style={{ fontSize }}
        aria-hidden
      >
        <p>{text}</p>
      </div>
      <div
        className={cn(
          layerBase,
          'left-[3.27px] top-[112.04px] blur-[3.271px] text-[red]',
          'animate-[opening-chroma-drift_5s_ease-in-out_infinite]',
        )}
        style={{ fontSize }}
        aria-hidden
      >
        <p>{text}</p>
      </div>
      <div
        className={cn(layerBase, 'left-[1.64px] top-[115.31px] mix-blend-hard-light text-white')}
        style={{ fontSize }}
      >
        <p>{text}</p>
      </div>
    </div>
  );
}
