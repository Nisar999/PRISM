import { cn } from '@/lib/utils';
import { WorkspaceIcon } from '@/components/ui/WorkspaceIcon';
import chevronDown from '@/assets/figma/workspace/icon-chevron-down.svg';

export interface ToolbarSelectProps {
  iconSrc: string;
  label: string;
  onClick?: () => void;
  className?: string;
  empty?: boolean;
}

/** Worktree / branch selector chip under the composer. */
export function ToolbarSelect({ iconSrc, label, onClick, className, empty }: ToolbarSelectProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors duration-150',
        'hover:bg-prism-soft focus-visible:outline focus-visible:outline-1 focus-visible:outline-prism-focus',
        'active:scale-[0.98]',
        empty ? 'text-prism-dim' : 'text-white',
        className,
      )}
    >
      <WorkspaceIcon src={iconSrc} size={19} />
      <span className="font-manrope text-[16.173px] font-normal leading-none">{label}</span>
      <WorkspaceIcon src={chevronDown} size={18} />
    </button>
  );
}
