import { cn } from '@/lib/utils';

export type LandingTabId = 'signup' | 'login';

export interface LandingTabsProps {
  active: LandingTabId;
  onChange: (tab: LandingTabId) => void;
  className?: string;
  underlineSrc?: string;
}

/** SIGN UP / LOG IN tabs with cyan underline — Figma 433:1967+. */
export function LandingTabs({ active, onChange, className, underlineSrc }: LandingTabsProps) {
  const tabCls = (id: LandingTabId) =>
    cn(
      "font-['Afacad_Flux'] text-[36px] font-extralight leading-none transition-colors duration-200",
      active === id ? 'text-white' : 'text-white/45 hover:text-white/75',
    );

  return (
    <div className={cn('relative', className)}>
      <div className="flex items-start gap-[35px]">
        <button type="button" className={tabCls('signup')} onClick={() => onChange('signup')}>
          SIGN UP
        </button>
        <button type="button" className={tabCls('login')} onClick={() => onChange('login')}>
          LOG IN
        </button>
      </div>
      {underlineSrc ? (
        <img
          src={underlineSrc}
          alt=""
          className={cn(
            'pointer-events-none absolute top-[56px] h-[10px] w-[109px] transition-all duration-300',
            active === 'signup' ? 'left-[0px] opacity-100' : 'left-[157px] opacity-100',
          )}
          draggable={false}
        />
      ) : (
        <span
          className={cn(
            'absolute top-[54px] h-[3px] w-[109px] rounded-full bg-[#00bfff] shadow-[0_0_12px_rgba(0,191,255,0.85)] transition-all duration-300',
            active === 'signup' ? 'left-0' : 'left-[157px]',
          )}
        />
      )}
    </div>
  );
}
