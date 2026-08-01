import micOrb from '@/assets/figma/workspace/mic-orb.svg';
import micA from '@/assets/figma/workspace/icon-mic-a.svg';
import micB from '@/assets/figma/workspace/icon-mic-b.svg';
import micC from '@/assets/figma/workspace/icon-mic-c.svg';
import micD from '@/assets/figma/workspace/icon-mic-d.svg';
import { cn } from '@/lib/utils';

export interface MicButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/** Circular mic control — Figma 506:440 + 506:434. */
export function MicButton({ onClick, disabled, className }: MicButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label="Voice input"
      className={cn(
        'relative h-[50px] w-[52px] shrink-0 transition-transform duration-150',
        'hover:scale-105 active:scale-95 disabled:opacity-40',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-prism-focus',
        className,
      )}
    >
      <img src={micOrb} alt="" className="absolute inset-0 size-full" draggable={false} />
      <span className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 overflow-hidden">
        <span className="relative block size-full">
          <img
            src={micA}
            alt=""
            className="absolute inset-x-[33%] bottom-[12.5%] top-[87.5%] h-auto w-auto max-w-none"
            draggable={false}
          />
          <img
            src={micB}
            alt=""
            className="absolute bottom-[12.5%] left-1/2 top-3/4 h-auto w-px -translate-x-1/2"
            draggable={false}
          />
          <img
            src={micC}
            alt=""
            className="absolute inset-x-[33%] bottom-[37.5%] top-[12.5%] h-auto w-auto max-w-none"
            draggable={false}
          />
          <img
            src={micD}
            alt=""
            className="absolute inset-x-[21%] bottom-1/4 top-[46%] h-auto w-auto max-w-none"
            draggable={false}
          />
        </span>
      </span>
    </button>
  );
}
