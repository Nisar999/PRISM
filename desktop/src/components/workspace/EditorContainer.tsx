import { cn } from '@/lib/utils';

export interface EditorContainerProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

/** Full-bleed editor host chrome for IDE shell (no card framing). */
export function EditorContainer({ children, title = 'Editor', className }: EditorContainerProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden bg-prism-editor', className)}>
      <div className="flex h-8 shrink-0 items-center border-b border-white/[0.06] bg-prism-panel px-3">
        <span className="font-manrope text-[11px] font-semibold uppercase tracking-[0.08em] text-prism-meta">
          {title}
        </span>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
