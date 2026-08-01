import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface PanelResizeHandleProps {
  axis: 'x' | 'y';
  /** Called with delta in CSS pixels for this drag frame. */
  onDrag: (delta: number) => void;
  className?: string;
  label?: string;
}

/** Presentation-only splitter — no layout manager changes. */
export function PanelResizeHandle({
  axis,
  onDrag,
  className,
  label = 'Resize panel',
}: PanelResizeHandleProps) {
  const last = useRef<number | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      last.current = axis === 'x' ? e.clientX : e.clientY;

      const onMove = (ev: PointerEvent) => {
        const pos = axis === 'x' ? ev.clientX : ev.clientY;
        if (last.current == null) {
          last.current = pos;
          return;
        }
        const delta = pos - last.current;
        last.current = pos;
        if (delta !== 0) onDrag(delta);
      };

      const onUp = (ev: PointerEvent) => {
        last.current = null;
        el.releasePointerCapture(ev.pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [axis, onDrag],
  );

  return (
    <div
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      className={cn(
        'shrink-0 bg-transparent hover:bg-prism-focus/25 active:bg-prism-focus/40',
        axis === 'x' ? 'w-[3px] cursor-col-resize' : 'h-[3px] cursor-row-resize',
        className,
      )}
    />
  );
}
