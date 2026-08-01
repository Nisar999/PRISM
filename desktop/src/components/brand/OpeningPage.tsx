import heroUrl from '@/assets/figma/opening/prism-hero.png';
import { ChromaticWordmark } from '@/components/ui/ChromaticWordmark';
import { DesignCanvas, OPENING_PAGE_SIZE } from '@/components/ui/DesignCanvas';
import { GlowPillButton } from '@/components/ui/GlowPillButton';
import { cn } from '@/lib/utils';

/**
 * Figma Opening Page — node 479:66 (visible composition from nested 479:97).
 * Pixel layout in 1440×1024 design space. Presentation only.
 */
export interface OpeningPageProps {
  onStart?: () => void;
  leaving?: boolean;
  className?: string;
}

export function OpeningPage({ onStart, leaving = false, className }: OpeningPageProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] bg-prism-editor transition-opacity duration-[420ms] ease-out',
        leaving ? 'opacity-0 pointer-events-none' : 'opacity-100',
        className,
      )}
      data-node-id="479:66"
      data-name="Opening Page"
    >
      <DesignCanvas
        width={OPENING_PAGE_SIZE.width}
        height={OPENING_PAGE_SIZE.height}
      >
        <div className="relative h-[1024px] w-[1440px] overflow-clip bg-[#131314]">
          {/* Hero prism — node 478:237 */}
          <div
            className="pointer-events-none absolute left-1/2 top-[-958px] h-[2361px] w-[2837px] -translate-x-1/2 opacity-[0.71]"
            data-node-id="478:237"
          >
            <img
              src={heroUrl}
              alt=""
              className="pointer-events-none absolute inset-0 size-full max-w-none object-cover"
              draggable={false}
            />
          </div>

          {/* WELCOME TO THE — node 479:100 */}
          <div
            className="absolute left-[calc(50%-215px)] top-[237.5px] flex h-[67px] w-[429px] -translate-y-1/2 flex-col justify-center font-afacad text-[48px] font-bold not-italic leading-none tracking-[6.24px] text-white"
            data-node-id="479:100"
          >
            <p className="leading-normal">WELCOME TO THE</p>
          </div>

          {/* PRISM chromatic stack — node 479:120 */}
          <div
            className="absolute left-[302px] top-[293px]"
            data-node-id="479:120"
          >
            <ChromaticWordmark text="PRISM" />
          </div>

          {/* Tagline — node 479:126 */}
          <div
            className="absolute left-[calc(50%-347px)] top-[590.5px] flex h-[27px] w-[695px] -translate-y-1/2 flex-col justify-center font-afacad text-[48px] font-light not-italic leading-none tracking-[5.76px] text-white"
            data-node-id="479:126"
          >
            <p className="leading-normal">ONE MIND. INFINITE SHAPES</p>
          </div>

          {/* CTA — nodes 479:118 + 479:119 */}
          <GlowPillButton
            label="let's Start Innovating !"
            onClick={onStart}
            className="absolute left-1/2 top-[744px] h-[87px] w-[479px] -translate-x-1/2 text-[43.545px]"
            data-node-id="479:118"
            aria-label="Start innovating"
          />

          {/* Copyright — node 479:125 */}
          <p
            className="absolute left-[calc(50%-252px)] top-[970px] w-[505px] font-poller text-[21.315px] not-italic leading-[1.6] text-white"
            data-node-id="479:125"
          >
            ©2026 PRISM IDE. All rights reserved
          </p>
        </div>
      </DesignCanvas>
    </div>
  );
}
