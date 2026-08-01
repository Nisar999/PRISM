import { cn } from '@/lib/utils';
import { ShapesAccent } from '@/components/dashboard/ShapesAccent';

export interface HeroPanelProps {
  eyebrow?: string;
  titleLine1?: string;
  titleAccent?: string;
  subtitle?: string;
  workspaceLabel?: string | null;
  className?: string;
}

/** Left hero copy — Figma 443:1981 / 441:1955 / 445:1992. */
export function HeroPanel({
  eyebrow = 'WELCOME TO THE PRISM',
  titleLine1 = 'ONE MIND.',
  titleAccent = 'SHAPES',
  subtitle = 'Your intelligent workspace to create, collaborate and conquer',
  workspaceLabel,
  className,
}: HeroPanelProps) {
  return (
    <div className={cn('relative z-[2]', className)}>
      <p className="font-['Manrope'] text-[20px] font-bold capitalize leading-normal text-[#686868]">
        {eyebrow}
      </p>
      <h1 className="mt-4 font-['Manrope'] text-[51.333px] font-semibold capitalize leading-[1.2] tracking-[0.5133px] text-white">
        <span className="block">{titleLine1}</span>
        <span className="block">
          INFINITE{' '}
          {titleAccent === 'SHAPES' ? (
            <ShapesAccent />
          ) : (
            <span className="font-['Instrument_Serif'] italic">{titleAccent}</span>
          )}
          .
        </span>
      </h1>
      <p className="mt-4 max-w-[377px] font-['Manrope'] text-[20px] font-bold capitalize leading-normal text-[#686868]">
        {subtitle}
      </p>
      {workspaceLabel ? (
        <p className="mt-3 font-['Manrope'] text-[14px] font-semibold uppercase tracking-[0.08em] text-[#00bfff]">
          {workspaceLabel}
        </p>
      ) : (
        <p className="mt-3 font-['Manrope'] text-[14px] font-semibold uppercase tracking-[0.08em] text-[#444444]">
          No active workspace
        </p>
      )}
    </div>
  );
}
