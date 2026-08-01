import { cn } from '@/lib/utils';

export interface SoftGlowOrbProps {
  src: string;
  className?: string;
  rotateDeg?: number;
}

/** Ambient blue glow ellipse from Figma. */
export function SoftGlowOrb({ src, className, rotateDeg = 0 }: SoftGlowOrbProps) {
  return (
    <div
      className={cn('pointer-events-none absolute', className)}
      aria-hidden
      style={rotateDeg ? { transform: `rotate(${rotateDeg}deg)` } : undefined}
    >
      <img src={src} alt="" className="size-full max-w-none object-contain opacity-90" draggable={false} />
    </div>
  );
}
