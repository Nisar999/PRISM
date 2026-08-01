import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const DESIGN_W = 1440;
const DESIGN_H = 1024;

/**
 * Scales a fixed Figma artboard to fit the viewport while preserving layout.
 */
export function DesignCanvas({
  children,
  className,
  width = DESIGN_W,
  height = DESIGN_H,
}: {
  children: ReactNode;
  className?: string;
  width?: number;
  height?: number;
}) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const sx = window.innerWidth / width;
      const sy = window.innerHeight / height;
      setScale(Math.min(sx, sy));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [width, height]);

  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width,
          height,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export const OPENING_PAGE_SIZE = { width: DESIGN_W, height: DESIGN_H } as const;
