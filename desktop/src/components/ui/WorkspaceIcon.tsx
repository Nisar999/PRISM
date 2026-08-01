import { cn } from '@/lib/utils';

export interface WorkspaceIconProps {
  src: string;
  size?: number;
  className?: string;
  alt?: string;
}

/** Fixed-size Figma icon leaf — fills a square clip box. */
export function WorkspaceIcon({ src, size = 20, className, alt = '' }: WorkspaceIconProps) {
  return (
    <span
      className={cn('relative inline-flex shrink-0 overflow-hidden items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <img src={src} alt={alt} className="block size-full max-w-none object-contain" draggable={false} />
    </span>
  );
}
