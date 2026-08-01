import { Link } from 'react-router-dom';
import { brandAssets } from '@/lib/brand';
import { cn } from '@/lib/utils';

export type EmptyVariant = 'milly' | 'element' | 'logo' | 'none';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  variant?: EmptyVariant;
  className?: string;
}

/**
 * Intentional empty surface — illustration + copy + next action.
 * Milly appears only when variant="milly" (companion, not chrome).
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  variant = 'element',
  className,
}: EmptyStateProps) {
  const src =
    variant === 'milly'
      ? brandAssets.milly
      : variant === 'logo'
        ? brandAssets.logo
        : variant === 'element'
          ? brandAssets.element
          : null;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-12 rounded-xl border border-dashed border-border bg-card/40',
        className,
      )}
    >
      {src && (
        <img
          src={src}
          alt=""
          className={cn(
            'object-contain mb-5 opacity-90',
            variant === 'milly' ? 'h-28 w-auto' : 'h-20 w-auto max-w-[200px]',
          )}
          draggable={false}
        />
      )}
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
        {description}
      </p>
      {(actionLabel && actionTo) || (actionLabel && onAction) ? (
        <div className="mt-5">
          {actionTo ? (
            <Link
              to={actionTo}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/95"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/95"
            >
              {actionLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
