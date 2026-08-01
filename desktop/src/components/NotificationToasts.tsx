import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2, X } from 'lucide-react';
import {
  useNotifications,
  notificationStore,
  type SystemNotification,
  type NotificationType,
} from '@/lib/store';
import { brandAssets } from '@/lib/brand';
import { cn } from '@/lib/utils';

const MAX_VISIBLE = 4;
const EXIT_MS = 200;

function iconFor(type: NotificationType) {
  switch (type) {
    case 'success':
      return CheckCircle2;
    case 'error':
      return XCircle;
    case 'warning':
    case 'validation':
      return AlertTriangle;
    case 'progress':
      return Loader2;
    case 'info':
      return Info;
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

function iconToneFor(type: NotificationType): string {
  switch (type) {
    case 'success':
      return 'text-emerald-400';
    case 'error':
      return 'text-rose-400';
    case 'warning':
    case 'validation':
      return 'text-amber-400';
    case 'progress':
      return 'text-prism-focus';
    case 'info':
      return 'text-prism-muted';
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

/** Auto-dismiss duration; null = sticky until the user dismisses it. */
function durationFor(type: NotificationType): number | null {
  switch (type) {
    case 'success':
      return 4000;
    case 'info':
      return 5000;
    case 'warning':
      return 8000;
    case 'error':
    case 'validation':
    case 'progress':
      return null;
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

/**
 * Unified notification surface — bottom-right toast stack.
 * Newest at the bottom; up to MAX_VISIBLE visible, remainder queued.
 * Success/info/warning auto-dismiss (paused on hover); errors, validation
 * and progress stay until resolved or dismissed.
 */
export function NotificationToasts() {
  const { notifications } = useNotifications();
  const unread = notifications.filter((n) => !n.read);
  // Store keeps newest first; render oldest at top, newest nearest the corner.
  const visible = unread.slice(0, MAX_VISIBLE).slice().reverse();
  const queued = unread.length - Math.min(unread.length, MAX_VISIBLE);

  if (visible.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-10 right-4 z-[300] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col items-end gap-2"
      data-name="NotificationToasts"
      role="region"
      aria-label="Notifications"
    >
      {queued > 0 ? (
        <div className="pointer-events-auto rounded-full border border-white/10 bg-prism-panel px-2.5 py-1 font-manrope text-[11px] font-medium text-prism-muted shadow-prism-elevated prism-toast-in">
          +{queued} more queued
        </div>
      ) : null}
      {visible.map((n) => (
        <Toast key={n.id} notification={n} />
      ))}
    </div>
  );
}

function Toast({ notification: n }: { notification: SystemNotification }) {
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<number | null>(null);
  const leaveRef = useRef<number | null>(null);

  const startExit = () => {
    if (leaveRef.current) return;
    setLeaving(true);
    leaveRef.current = window.setTimeout(() => {
      notificationStore.dismiss(n.id);
    }, EXIT_MS);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const armTimer = () => {
    clearTimer();
    const duration = durationFor(n.type);
    if (duration === null) return;
    timerRef.current = window.setTimeout(startExit, duration);
  };

  // Re-arm when the type changes (e.g. progress → success).
  useEffect(() => {
    armTimer();
    return () => {
      clearTimer();
      if (leaveRef.current) {
        window.clearTimeout(leaveRef.current);
        leaveRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n.type]);

  const Icon = iconFor(n.type);
  const millyMoment = n.type === 'success';
  const indeterminate = n.type === 'progress' && typeof n.progress !== 'number';

  return (
    <div
      className={cn(
        'pointer-events-auto w-full overflow-hidden rounded-xl border border-white/10 bg-prism-panel shadow-prism-elevated',
        leaving ? 'prism-toast-out' : 'prism-toast-in',
      )}
      role="status"
      aria-live={n.type === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={clearTimer}
      onMouseLeave={armTimer}
    >
      <div className="flex gap-2.5 p-3">
        {millyMoment ? (
          <img
            src={brandAssets.milly}
            alt=""
            className="size-8 shrink-0 object-contain"
            draggable={false}
          />
        ) : (
          <Icon
            className={cn(
              'mt-0.5 size-4 shrink-0',
              iconToneFor(n.type),
              n.type === 'progress' && 'animate-spin',
            )}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-manrope text-[13px] font-semibold leading-snug text-white">
            {n.message}
          </p>
          {n.description ? (
            <p className="mt-0.5 line-clamp-3 font-manrope text-[12px] leading-snug text-prism-muted">
              {n.description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          className="prism-focus-ring -m-1 h-fit shrink-0 rounded p-1 text-prism-dim transition-colors hover:bg-white/5 hover:text-white"
          onClick={startExit}
        >
          <X className="size-3.5" />
        </button>
      </div>

      {n.type === 'progress' ? (
        <div className="h-[3px] w-full overflow-hidden bg-white/[0.06]">
          {indeterminate ? (
            <div className="prism-progress-indeterminate h-full w-1/3 rounded-full bg-prism-focus/80" />
          ) : (
            <div
              className="h-full rounded-full bg-prism-focus/80 transition-[width] duration-300 ease-out"
              style={{ width: `${n.progress}%` }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
