import { useState } from 'react';
import glowLeft from '@/assets/figma/landing/glow-left.svg';
import glowRight from '@/assets/figma/landing/glow-right.png';
import prismCrystal from '@/assets/figma/landing/prism-crystal.png';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { GlassLoginPanel } from '@/components/auth/GlassLoginPanel';
import { BrandLockup } from '@/components/dashboard/BrandLockup';
import { HeroPanel } from '@/components/dashboard/HeroPanel';
import { DesignCanvas, OPENING_PAGE_SIZE } from '@/components/ui/DesignCanvas';
import { SoftGlowOrb } from '@/components/ui/SoftGlowOrb';
import { authService } from '@/lib/auth';
import { useIdentity } from '@/lib/identity';
import { providerManager, useProviders } from '@/lib/providers';
import { useKernel, useWorkspace, notificationStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export interface AuthScreenProps {
  onDone: () => void;
  leaving?: boolean;
  className?: string;
}

/**
 * SIGNUP/LOGIN — Figma 428:1986.
 * Real local authentication: signup creates a PBKDF2-verified profile,
 * login verifies the passphrase. The "Continue as Developer" shortcut is
 * DEV-only (hidden in production builds) and creates a real local session.
 */
export function AuthScreen({ onDone, leaving = false, className }: AuthScreenProps) {
  const workspace = useWorkspace();
  const identity = useIdentity();
  const providers = useProviders();
  const kernel = useKernel();
  const [busy, setBusy] = useState(false);

  const activeProvider = providers.activeProviderId
    ? providers.providers[providers.activeProviderId]
    : null;

  const finishIfAuthenticated = () => {
    if (authService.isAuthenticated()) {
      onDone();
    }
  };

  const onAuthSubmit = async ({
    tab,
    name,
    passphrase,
  }: {
    tab: 'signup' | 'login';
    name: string;
    passphrase: string;
  }) => {
    if (busy) return;
    setBusy(true);
    try {
      if (tab === 'signup') {
        await authService.signup(name, passphrase);
      } else {
        await authService.login(name, passphrase);
      }
      finishIfAuthenticated();
    } catch (err) {
      notificationStore.addNotification({
        type: 'error',
        message: tab === 'signup' ? 'Sign up failed' : 'Sign in failed',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const onContinueDeveloper = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await authService.loginDeveloper();
      finishIfAuthenticated();
    } catch (err) {
      notificationStore.addNotification({
        type: 'error',
        message: 'Developer session failed',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const onSocial = (provider: 'google' | 'github') => {
    const label = provider === 'google' ? 'Google' : 'GitHub';
    notificationStore.addNotification({
      type: 'info',
      message: `${label} sign-in arrives with cloud sync`,
      description:
        'PRISM v1 is local-first: create a local identity instead — your profile and passphrase never leave this device.',
    });
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] bg-prism-editor transition-opacity duration-[420ms] ease-out',
        leaving ? 'opacity-0 pointer-events-none' : 'opacity-100',
        className,
      )}
      data-node-id="428:1986"
      data-name="SIGNUP / LOGIN"
    >
      <AuthBackground className="h-full w-full">
        <DesignCanvas width={OPENING_PAGE_SIZE.width} height={OPENING_PAGE_SIZE.height}>
          <div className="relative h-[1024px] w-[1440px] overflow-hidden bg-[var(--prism-bg-editor)]">
            <SoftGlowOrb
              src={glowLeft}
              className="left-[-347px] top-[-107px] h-[1185px] w-[723px] -rotate-12 opacity-80"
            />
            <SoftGlowOrb
              src={glowRight}
              className="left-[836px] top-[336px] h-[653px] w-[1176px] opacity-70"
              rotateDeg={96}
            />

            <div className="pointer-events-none absolute left-[-380px] top-[400px] flex h-[1144px] w-[1375px] items-center justify-center">
              <div className="h-[1144px] w-[1375px] rotate-180">
                <img
                  src={prismCrystal}
                  alt=""
                  className="size-full max-w-none object-cover opacity-95"
                  draggable={false}
                />
              </div>
            </div>

            <BrandLockup className="absolute right-[40px] top-[12px] w-[380px]" />

            <HeroPanel
              className="absolute left-[200px] top-[200px] w-[435px]"
              workspaceLabel={
                workspace.activeProject
                  ? `Workspace · ${workspace.activeProject.name}`
                  : null
              }
              subtitle={
                identity.activeIdentity
                  ? `Signed in as ${identity.activeIdentity.name} — create, collaborate and conquer`
                  : 'Your intelligent workspace to create, collaborate and conquer'
              }
            />

            <div className="absolute left-[760px] top-[140px]">
              <GlassLoginPanel
                providerName={activeProvider?.name ?? providers.activeProviderId}
                providerOnline={kernel.isOnline}
                providers={Object.values(providers.providers)}
                activeProviderId={providers.activeProviderId}
                onSelectProvider={(id) => {
                  void providerManager.selectProvider(id, { softFail: true });
                }}
                initialEmail={identity.activeIdentity?.email ?? ''}
                loading={busy}
                identityLabel={identity.activeIdentity?.name ?? identity.activeIdentity?.username}
                onAuthSubmit={onAuthSubmit}
                onSocial={onSocial}
                onContinueDeveloper={import.meta.env.DEV ? onContinueDeveloper : undefined}
              />
            </div>
          </div>
        </DesignCanvas>
      </AuthBackground>
    </div>
  );
}
