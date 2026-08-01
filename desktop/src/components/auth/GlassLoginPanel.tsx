import { FormEvent, useEffect, useRef, useState } from 'react';
import mailUrl from '@/assets/figma/landing/icon-mail.svg';
import googleUrl from '@/assets/figma/landing/google.png';
import githubUrl from '@/assets/figma/landing/github.svg';
import lineOrL from '@/assets/figma/landing/line-or-l.svg';
import lineOrR from '@/assets/figma/landing/line-or-r.svg';
import lineTab from '@/assets/figma/landing/line-tab.svg';
import { ChevronPillButton } from '@/components/ui/ChevronPillButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { LandingTabs, type LandingTabId } from '@/components/ui/LandingTabs';
import { ProviderIndicator } from '@/components/ui/ProviderIndicator';
import { SocialAuthButton } from '@/components/ui/SocialAuthButton';
import type { ProviderDefinition } from '@/lib/providers';
import { cn } from '@/lib/utils';

export interface GlassLoginPanelProps {
  className?: string;
  providerName: string | null;
  providerOnline?: boolean;
  providers?: ProviderDefinition[];
  activeProviderId?: string | null;
  onSelectProvider?: (providerId: string) => void;
  namePlaceholder?: string;
  passphrasePlaceholder?: string;
  initialEmail?: string;
  loading?: boolean;
  identityLabel?: string | null;
  onAuthSubmit?: (payload: { tab: LandingTabId; name: string; passphrase: string }) => void;
  onSocial?: (provider: 'google' | 'github') => void;
  /** DEV-only developer shortcut. Hidden in production builds (caller passes undefined). */
  onContinueDeveloper?: () => void;
}

/**
 * Glass login panel — Figma 428:1986 / 433:1965 presentation.
 * Real local authentication: signup creates a PBKDF2-verified profile, login
 * verifies the passphrase. The "Continue as Developer" shortcut is rendered
 * only when the caller supplies onContinueDeveloper (DEV builds).
 */
export function GlassLoginPanel({
  className,
  providerName,
  providerOnline,
  providers = [],
  activeProviderId,
  onSelectProvider,
  namePlaceholder = 'Enter your NAME',
  passphrasePlaceholder = 'Enter your PASSPHRASE',
  initialEmail = '',
  loading = false,
  identityLabel,
  onAuthSubmit,
  onSocial,
  onContinueDeveloper,
}: GlassLoginPanelProps) {
  const [tab, setTab] = useState<LandingTabId>('signup');
  const [name, setName] = useState(initialEmail);
  const [passphrase, setPassphrase] = useState('');
  const [providerOpen, setProviderOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const providerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!providerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!providerRef.current?.contains(e.target as Node)) setProviderOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [providerOpen]);

  const nameEmpty = name.trim().length === 0;
  const passphraseShort = passphrase.length < 4;
  const canSubmit = !loading && !nameEmpty && !passphraseShort;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    setTouched(true);
    if (!canSubmit) return;
    onAuthSubmit?.({ tab, name: name.trim(), passphrase });
  };

  return (
    <GlassCard
      className={cn('h-auto min-h-[640px] w-[560px] max-w-full prism-enter', className)}
      data-node-id="433:1965"
    >
      <form
        className="relative flex h-full w-full flex-col px-[56px] pb-8 pt-[40px]"
        onSubmit={submit}
        noValidate
      >
        <LandingTabs active={tab} onChange={setTab} underlineSrc={lineTab} />

        <h2 className="mt-[36px] font-['Afacad_Flux'] text-[36px] font-semibold leading-[0.87] tracking-[1.08px] text-white">
          WELCOME TO PRISM
        </h2>
        <p className="mt-3 max-w-[307px] font-['ADLaM_Display'] text-[13px] leading-[1.156] tracking-[0.39px] text-[var(--prism-text-dim)]">
          EXPLORE A DIFFERENT DIMENSION OF INTELLIGENCE AND DEVELOPMENT
        </p>

        <div className="relative mt-4" ref={providerRef}>
          <ProviderIndicator
            name={providerName}
            online={providerOnline}
            interactive={providers.length > 0 && Boolean(onSelectProvider)}
            open={providerOpen}
            onToggle={() => setProviderOpen((v) => !v)}
          />
          {providerOpen && providers.length > 0 ? (
            <div
              role="listbox"
              aria-label="Providers"
              className="absolute left-0 top-full z-20 mt-2 min-w-[240px] rounded-md border border-white/10 bg-prism-panel py-1 shadow-prism-elevated"
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
                    setProviderOpen(false);
                  }}
                >
                  <span>{p.name}</span>
                  <span className="text-[11px] uppercase text-prism-dim">{p.status}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <p
          className="mt-3 font-['Manrope'] text-[12px] font-semibold leading-snug text-[var(--prism-text-muted)]"
          role="status"
        >
          Local-first v1 — your profile and passphrase stay on this device.
        </p>

        <div className="mt-5 space-y-5">
          <GlassInput
            iconSrc={mailUrl}
            type="text"
            autoComplete="username"
            placeholder={namePlaceholder}
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            aria-label="Name"
            disabled={loading}
          />
          {touched && nameEmpty ? (
            <p className="-mt-3 font-['Manrope'] text-[11px] text-[var(--prism-danger,#ff6b6b)]">
              Name is required.
            </p>
          ) : null}
          <GlassInput
            iconSrc={mailUrl}
            type="password"
            autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
            placeholder={passphrasePlaceholder}
            value={passphrase}
            onChange={(ev) => setPassphrase(ev.target.value)}
            aria-label="Passphrase"
            disabled={loading}
          />
          {touched && passphraseShort ? (
            <p className="-mt-3 font-['Manrope'] text-[11px] text-[var(--prism-danger,#ff6b6b)]">
              Passphrase must be at least 4 characters.
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <ChevronPillButton
            type="submit"
            aria-label={tab === 'signup' ? 'Create account' : 'Sign in'}
            disabled={loading || !canSubmit}
            loading={loading}
          />
          {identityLabel ? (
            <p
              className="font-['Manrope'] text-[12px] text-[var(--prism-text-muted)]"
              role="status"
            >
              Currently signed in as {identityLabel}.
            </p>
          ) : null}
          {onContinueDeveloper ? (
            <button
              type="button"
              onClick={onContinueDeveloper}
              disabled={loading}
              className={cn(
                'font-["Manrope"] text-[13px] font-semibold uppercase tracking-[0.06em]',
                'text-[var(--prism-focus)] transition-opacity duration-ui',
                'hover:opacity-80 focus-visible:outline focus-visible:outline-2',
                'focus-visible:outline-offset-2 focus-visible:outline-[var(--prism-focus)]',
                'active:scale-[0.98] disabled:opacity-40',
              )}
            >
              Continue as Developer
            </button>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <img src={lineOrL} alt="" className="h-px w-[140px]" draggable={false} />
          <span className="font-['Afacad_Flux'] text-[24px] font-bold text-white">OR</span>
          <img src={lineOrR} alt="" className="h-px w-[140px]" draggable={false} />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <SocialAuthButton
            className="w-[200px]"
            logoSrc={googleUrl}
            label={tab === 'signup' ? 'SIGNUP WITH GOOGLE' : 'LOGIN WITH GOOGLE'}
            disabled={loading}
            loading={loading}
            onClick={() => onSocial?.('google')}
          />
          <SocialAuthButton
            className="w-[200px]"
            logoSrc={githubUrl}
            label={tab === 'signup' ? 'SIGNUP WITH GITHUB' : 'LOGIN WITH GITHUB'}
            disabled={loading}
            loading={loading}
            onClick={() => onSocial?.('github')}
          />
        </div>
      </form>
    </GlassCard>
  );
}
