import { useNotifications, notificationStore } from '@/lib/store';
import { brandAssets } from '@/lib/brand';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

function iconFor(type: string) {
  switch (type) {
    case 'success':
      return CheckCircle2;
    case 'error':
      return XCircle;
    case 'warning':
    case 'validation':
      return AlertTriangle;
    default:
      return Info;
  }
}

function toneFor(type: string) {
  switch (type) {
    case 'success':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600';
    case 'error':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-600';
    case 'warning':
    case 'validation':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-600';
    default:
      return 'border-border bg-card text-foreground';
  }
}

export function NotificationToasts() {
  const { notifications } = useNotifications();
  const visible = notifications.filter((n) => !n.read).slice(0, 4);

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-10 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
      {visible.map((n) => {
        const Icon = iconFor(n.type);
        const millyMoment = n.type === 'success';
        return (
          <div
            key={n.id}
            className={cn(
              'pointer-events-auto border rounded-lg p-3 shadow-sm flex gap-2 text-sm',
              toneFor(n.type),
            )}
          >
            {millyMoment ? (
              <img
                src={brandAssets.milly}
                alt=""
                className="w-8 h-8 object-contain shrink-0"
                draggable={false}
              />
            ) : (
              <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{n.message}</p>
              {n.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">
                  {n.description}
                </p>
              )}
            </div>
            <button
              type="button"
              className="shrink-0 p-0.5 rounded hover:bg-background/50 text-muted-foreground"
              onClick={() => notificationStore.markAsRead(n.id)}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
