import { cn } from '@/lib/utils';

export interface BrandLockupProps {
  title?: string;
  tagline?: string;
  className?: string;
}

/** Top-right PRISM lockup — Figma 428:1998 / 433:1964. */
export function BrandLockup({
  title = 'PRISM',
  tagline = 'ONE MIND INFINITE SHAPES',
  className,
}: BrandLockupProps) {
  return (
    <div className={cn('text-right', className)}>
      <p className="font-['Afacad_Flux'] text-[147.836px] font-bold leading-none text-white">{title}</p>
      <p className="mt-2 text-center font-['Afacad_Flux'] text-[26.279px] font-thin tracking-[3.1534px] text-white">
        {tagline}
      </p>
    </div>
  );
}
