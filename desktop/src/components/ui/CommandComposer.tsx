import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import chevronDown from '@/assets/figma/workspace/icon-chevron-down.svg';
import { MicButton } from '@/components/ui/MicButton';
import { WorkspaceIcon } from '@/components/ui/WorkspaceIcon';
import { cn } from '@/lib/utils';

export interface ComposerProviderOption {
  id: string;
  name: string;
  status?: string;
  type?: 'local' | 'cloud';
  capabilities?: string[];
  models?: string[];
  latency?: number;
  error?: string;
}

export interface CommandComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  modelLabel: string;
  onModelClick?: () => void;
  providers?: ComposerProviderOption[];
  activeProviderId?: string | null;
  activeModelId?: string | null;
  onSelectProvider?: (providerId: string) => void;
  onSelectModel?: (providerId: string, modelId: string) => void;
  placeholder?: string;
  busy?: boolean;
  onCancel?: () => void;
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
  activeModelId,
  onSelectProvider,
  onSelectModel,
  placeholder = 'Ask anything, @ to mention, / for actions',
  busy,
  onCancel,
  className,
  onMicClick,
}: CommandComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen && activeProviderId) setExpandedId(activeProviderId);
  }, [menuOpen, activeProviderId]);

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
              aria-label="Providers and models"
              className="absolute bottom-full left-0 z-30 mb-2 max-h-[380px] w-[min(400px,92vw)] overflow-y-auto rounded-lg border border-white/10 bg-prism-panel py-1.5 shadow-prism-elevated scrollbar-thin"
            >
              {providers.map((p) => {
                const active = p.id === activeProviderId;
                const expanded = expandedId === p.id;
                const models = (p.models ?? []).filter((m) => m && !m.startsWith('('));
                return (
                  <div key={p.id} className="border-b border-white/[0.04] last:border-b-0">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={cn(
                        'flex w-full flex-col gap-1.5 px-3.5 py-2.5 text-left font-manrope',
                        active ? 'bg-white/[0.08] text-white' : 'text-prism-muted hover:bg-white/[0.04] hover:text-white',
                      )}
                      onClick={() => {
                        onSelectProvider?.(p.id);
                        if (models.length > 0) {
                          setExpandedId(p.id);
                          if (!onSelectModel) setMenuOpen(false);
                        } else {
                          setMenuOpen(false);
                        }
                      }}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold tracking-tight text-white">{p.name}</span>
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                            p.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-200'
                              : 'bg-white/5 text-prism-dim',
                          )}
                        >
                          {p.status ?? 'offline'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] leading-none text-prism-dim">
                        <span className="text-prism-muted">{p.type === 'cloud' ? 'Cloud' : 'Local'}</span>
                        {(p.capabilities ?? []).slice(0, 4).map((c) => (
                          <span key={c} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-prism-muted">
                            {c}
                          </span>
                        ))}
                        {typeof p.latency === 'number' ? <span>{p.latency} ms</span> : null}
                      </div>
                      {p.error ? (
                        <div className="truncate text-[11px] text-amber-200/80">{p.error}</div>
                      ) : null}
                    </button>
                    {expanded && models.length > 0 && onSelectModel ? (
                      <div className="space-y-0.5 bg-black/25 px-2.5 pb-2.5 pt-1">
                        <p className="px-1 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-prism-dim">
                          Model
                        </p>
                        {models.slice(0, 14).map((m) => {
                          const selected = active && (activeModelId === m || (!activeModelId && m === models[0]));
                          return (
                            <button
                              key={m}
                              type="button"
                              className={cn(
                                'flex w-full truncate rounded-md px-2.5 py-1.5 text-left font-manrope text-[12px] leading-snug',
                                selected
                                  ? 'bg-prism-focus/20 text-white'
                                  : 'text-prism-muted hover:bg-white/[0.05] hover:text-white',
                              )}
                              onClick={() => {
                                onSelectModel(p.id, m);
                                setMenuOpen(false);
                              }}
                            >
                              {m}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
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
                    Open provider settings…
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
          {busy && onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-control border border-rose-400/35 bg-rose-500/15 px-3 py-1.5 font-manrope text-[12px] text-rose-100 transition-colors hover:bg-rose-500/25"
            >
              Stop
            </button>
          ) : (
            <MicButton onClick={onMicClick} disabled={busy} />
          )}
        </div>
      </div>
    </form>
  );
}
