import { cn } from '@/lib/utils';

export interface LaunchIdeButtonProps {
  label?: string;
  onClick?: () => void;
  className?: string;
}

/** Ghost CTA — Figma Launch PRISM IDE (478:287 / 488:387). */
export function LaunchIdeButton({
  label = 'Launch PRISM IDE',
  onClick,
  className,
}: LaunchIdeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative h-[53.5px] w-[214px] rounded-[6.242px] border-[0.892px] border-black bg-[#d9d9d9] p-[2.5px]',
        'transition-transform duration-150 hover:brightness-110 active:scale-[0.98]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        className,
      )}
    >
      <span className="flex h-full w-full items-center justify-center rounded-[5.722px] bg-[#121212]">
        <span className="font-afacad text-[20px] font-semibold uppercase leading-none text-white">
          {label}
        </span>
      </span>
    </button>
  );
}
