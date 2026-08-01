import { useEffect, useState } from 'react';
import { AuthScreen } from '@/components/brand/AuthScreen';
import { OpeningPage } from '@/components/brand/OpeningPage';
import { authService } from '@/lib/auth';

const SPLASH_KEY = 'prism.splash.seen';

type GatePhase = 'welcome' | 'login' | 'done';

interface SplashScreenProps {
  onDone: () => void;
}

/**
 * Welcome (479:66) → Login (428:1986) → app.
 * No timers. Welcome advances only on CTA. Login advances only when
 * AuthenticationService reports an authenticated session — sessionStorage
 * no longer gates auth (the encrypted session on disk does).
 */
export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<GatePhase>(() => {
    try {
      if (sessionStorage.getItem(SPLASH_KEY) !== '1') return 'welcome';
    } catch {
      /* ignore */
    }
    // Skip straight to login if a valid encrypted session is restored on boot.
    if (authService.isAuthenticated()) return 'done';
    return 'login';
  });
  const [leavingWelcome, setLeavingWelcome] = useState(false);
  const [leavingLogin, setLeavingLogin] = useState(false);

  // If a session is restored after mount, advance to done.
  useEffect(() => {
    const unsub = authService.subscribe(() => {
      if (phase === 'login' && authService.isAuthenticated()) {
        finishLogin();
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const finishWelcome = () => {
    if (leavingWelcome || phase !== 'welcome') return;
    setLeavingWelcome(true);
    window.setTimeout(() => {
      try {
        sessionStorage.setItem(SPLASH_KEY, '1');
      } catch {
        /* ignore */
      }
      // After welcome, check auth — skip login if already restored.
      if (authService.isAuthenticated()) {
        setPhase('done');
        onDone();
      } else {
        setPhase('login');
      }
    }, 420);
  };

  const finishLogin = () => {
    if (leavingLogin || phase !== 'login') return;
    setLeavingLogin(true);
    window.setTimeout(() => {
      setPhase('done');
      onDone();
    }, 420);
  };

  if (phase === 'done') return null;

  if (phase === 'login') {
    return <AuthScreen leaving={leavingLogin} onDone={finishLogin} />;
  }

  return <OpeningPage leaving={leavingWelcome} onStart={finishWelcome} />;
}

export function shouldShowSplash(): boolean {
  try {
    if (sessionStorage.getItem(SPLASH_KEY) !== '1') return true;
  } catch {
    /* ignore */
  }
  // Show splash (welcome or login) when no authenticated session is restored.
  return !authService.isAuthenticated();
}
