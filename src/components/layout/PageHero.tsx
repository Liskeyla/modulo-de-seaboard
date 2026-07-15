import { ReactNode } from 'react';

interface PageHeroProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
}

export function PageHero({ title, subtitle, icon }: PageHeroProps) {
  return (
    <div className="dms-page-hero">
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm md:h-10 md:w-10">
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="dms-page-title">{title}</h1>
          {subtitle && <p className="dms-page-subtitle">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
