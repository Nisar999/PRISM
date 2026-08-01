import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { cn } from '@/lib/utils';

const IS_TAURI =
  typeof window !== 'undefined' &&
  !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;

/**
 * Native window controls (minimize / maximize–restore / close) for the
 * undecorated Tauri window. Compact PRISM chrome hit targets and glyphs.
 * Renders nothing outside the Tauri WebView (plain browser dev).
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!IS_TAURI) return;
    const win = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const sync = async () => {
      try {
        const value = await win.isMaximized();
        if (!disposed) setMaximized(value);
      } catch {
        /* window API unavailable */
      }
    };

    void sync();
    void win
      .onResized(() => {
        void sync();
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => {
        /* resize listener unavailable */
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  if (!IS_TAURI) return null;

  return (
    <div
      className="pointer-events-auto flex h-full shrink-0 items-stretch"
      data-name="WindowControls"
    >
      <ControlButton
        label="Minimize"
        onClick={() => void getCurrentWindow().minimize()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 5h10" stroke="currentColor" strokeWidth="1" shapeRendering="crispEdges" />
        </svg>
      </ControlButton>

      <ControlButton
        label={maximized ? 'Restore' : 'Maximize'}
        onClick={() => void getCurrentWindow().toggleMaximize()}
      >
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M2.5 2.5V0.5h7v7h-2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              shapeRendering="crispEdges"
            />
            <rect
              x="0.5"
              y="2.5"
              width="7"
              height="7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              shapeRendering="crispEdges"
            />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect
              x="0.5"
              y="0.5"
              width="9"
              height="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              shapeRendering="crispEdges"
            />
          </svg>
        )}
      </ControlButton>

      <ControlButton
        label="Close"
        close
        onClick={() => void getCurrentWindow().close()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M0.7 0.7l8.6 8.6M9.3 0.7L0.7 9.3"
            stroke="currentColor"
            strokeWidth="1.1"
          />
        </svg>
      </ControlButton>
    </div>
  );
}

function ControlButton({
  label,
  close = false,
  onClick,
  children,
}: {
  label: string;
  close?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      tabIndex={-1}
      className={cn(
        'flex h-full w-[46px] items-center justify-center text-prism-muted outline-none transition-colors duration-100',
        close
          ? 'hover:bg-[#e81123] hover:text-white active:bg-[#f1707a] active:text-white'
          : 'hover:bg-white/10 hover:text-white active:bg-white/[0.14]',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
