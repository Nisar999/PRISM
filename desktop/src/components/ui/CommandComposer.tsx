import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import chevronDown from '@/assets/figma/workspace/icon-chevron-down.svg';
import { MicButton } from '@/components/ui/MicButton';
import { WorkspaceIcon } from '@/components/ui/WorkspaceIcon';
import { cn } from '@/lib/utils';

export interface ComposerProviderOption {
  id: string;
  name: string;
  status?: string;
}

export interface CommandComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  modelLabel: string;
  onModelClick?: () => void;
  providers?: ComposerProviderOption[];
  activeProviderId?: string | null;
  onSelectProvider?: (providerId: string) => void;
  placeholder?: string;
  busy?: boolean;
  className?: string;
  onMicClick?: () => void;
}

/** Glass command omnibar — Figma 488:394 / 488:399. */
export function CommandComposer({
  value,
  onChange,
  onSubmit,
  modelLabel,
  onModelClick,
  providers = [],
  activeProviderId,
  onSelectProvider,
  placeholder = 'Ask anything, @ to mention, / for actions',
  busy,
  className,
  onMicClick,
}: CommandComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!value.trim() || busy) return;
    onSubmit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onModelButton = () => {
    if (providers.length > 0 && onSelectProvider) {
      setMenuOpen((v) => !v);
      return;
    }
    onModelClick?.();
  };

  return (
    <form
      onSubmit={submit}
      className={cn(
        'prism-composer-surface relative w-full max-w-[670px] overflow-visible',
        'transition-[box-shadow,border-color] duration-ui',
        'focus-within:border-prism-focus/30 focus-within:shadow-[0_8px_48px_rgba(0,191,255,0.12)]',
        className,
      )}
      data-node-id="488:394"
    >
      <div className="relative min-h-[128px] overflow-hidden rounded-[inherit] px-8 pb-3 pt-6">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          rows={2}
          placeholder={placeholder}
          aria-label="Ask PRISM"
          className={cn(
            'w-full resize-none bg-transparent font-manrope text-prism-base leading-normal',
            'text-white placeholder:text-white/50',
            'outline-none disabled:opacity-60',
          )}
        />
        <div className="relative mt-2 flex items-center justify-between gap-3" ref={menuRef}>
          <button
            type="button"
            onClick={onModelButton}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            className={cn(
              'inline-flex items-center gap-1 rounded-control px-1 py-0.5 text-white',
              'font-manrope text-prism-base transition-colors hover:bg-prism-soft',
              'prism-focus-ring-sm active:scale-[0.98]',
            )}
          >
            <span>{modelLabel}</span>
            <WorkspaceIcon src={chevronDown} size={24} />
          </button>
          {menuOpen && providers.length > 0 ? (
            <div
              role="listbox"
              aria-label="Providers"
              className="absolute bottom-full left-0 z-30 mb-2 min-w-[220px] rounded-md border border-white/10 bg-prism-panel py-1 shadow-prism-elevated"
            >
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={p.id === activeProviderId}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left font-manrope text-[13px]',
                    p.id === activeProviderId
                      ? 'bg-white/10 text-white'
                      : 'text-prism-muted hover:bg-white/5 hover:text-white',
                  )}
                  onClick={() => {
                    onSelectProvider?.(p.id);
                    setMenuOpen(false);
                  }}
                >
                  <span>{p.name}</span>
                  {p.status ? (
                    <span className="text-[11px] uppercase text-prism-dim">{p.status}</span>
                  ) : null}
                </button>
              ))}
              {onModelClick ? (
                <>
                  <div className="my-1 h-px bg-white/10" />
                  <button
                    type="button"
                    className="flex w-full px-3 py-2 text-left font-manrope text-[13px] text-prism-muted hover:bg-white/5 hover:text-white"
                    onClick={() => {
                      setMenuOpen(false);
                      onModelClick();
                    }}
                  >
                    Provider settings…
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
          <MicButton onClick={onMicClick} disabled={busy} />
        </div>
      </div>
    </form>
  );
}
