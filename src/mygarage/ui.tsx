// Small building blocks in the list.am style: buttons, cards, badges, bars, the wordmark.
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

type Variant = 'primary' | 'tint' | 'ghost' | 'danger' | 'dark';
const VARIANTS: Record<Variant, string> = {
  // the "Post an Ad" / "Search" blue
  primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-brand/40',
  // the "Add new vehicle" / "Go to parts" pale blue
  tint: 'bg-brand-tint text-brand hover:bg-brand-soft disabled:text-brand/40',
  ghost: 'bg-transparent text-ink-2 hover:bg-mist disabled:text-muted',
  danger: 'bg-hot text-white hover:brightness-95',
  dark: 'bg-night text-white hover:bg-ink',
};
const SIZES = { sm: 'text-sm px-3 h-8', md: 'text-[15px] px-4 h-10', lg: 'text-lg px-6 h-12', xl: 'text-xl px-8 h-14' };

export function Button({
  variant = 'primary',
  size = 'md',
  pill = false,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES; pill?: boolean }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed ${pill ? 'rounded-full' : 'rounded-lg'} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}

export function Card({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={`bg-paper rounded-2xl lift ${className}`}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = 'brand', className = '' }: { children: ReactNode; tone?: 'brand' | 'hot' | 'ok' | 'dark' | 'grey'; className?: string }) {
  const t = { brand: 'bg-brand-tint text-brand', hot: 'bg-hot text-white', ok: 'bg-ok/12 text-ok', dark: 'bg-night text-white', grey: 'bg-mist text-ink-2' }[tone];
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${t} ${className}`}>{children}</span>;
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`text-xs font-medium text-muted ${className}`}>{children}</div>;
}

/** a rounded progress bar */
export function Bar({ value, tone = 'brand', className = 'w-40 h-1.5' }: { value: number; tone?: 'brand' | 'hot' | 'ok' | 'warn' | 'ink'; className?: string }) {
  const c = { brand: 'bg-brand', hot: 'bg-hot', ok: 'bg-ok', warn: 'bg-warn', ink: 'bg-ink' }[tone];
  return (
    <div className={`bg-mist rounded-full overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${c} transition-all`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

/** the coin wallet as a pill */
export function Coins({ n, big = false, className = '' }: { n: number; big?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${big ? 'text-2xl display' : 'text-sm'} ${className}`}>
      <svg width={big ? 20 : 14} height={big ? 20 : 14} viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r="9" fill="#f7b500" />
        <circle cx="10" cy="10" r="6" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.6" />
      </svg>
      {fmt(n)}
    </span>
  );
}

/** the game's mark: a steering wheel in a blue rounded square (the host's own logo goes in the header beside it) */
export function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="9" fill="#0074f8" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeWidth="2.6" />
      <circle cx="16" cy="16" r="2.6" fill="#fff" />
      <path d="M7.4 14.2h6.3M18.3 14.2h6.3M16 18.6v6.2" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ size = 'text-xl', mark = 32 }: { size?: string; mark?: number }) {
  return (
    <div className="flex items-center gap-2.5 whitespace-nowrap">
      <Mark size={mark} />
      <span className={`display ${size} leading-none`}>
        <span className="text-ink">MyGarage</span> <span className="text-brand">Drive</span>
      </span>
    </div>
  );
}

/** a modal sheet in the list.am style (white, rounded, close button top right) */
export function Sheet({ title, children, onClose, id, wide = false }: { title: string; children: ReactNode; onClose: () => void; id: string; wide?: boolean }) {
  return (
    <div className="absolute inset-0 bg-night/45 pointer-events-auto flex justify-center overflow-y-auto p-4 rise" data-modal onClick={onClose}>
      <div id={id} className={`w-full my-auto ${wide ? 'max-w-3xl' : 'max-w-xl'} bg-paper rounded-2xl lift p-6 flex flex-col gap-4`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4">
          <div className="display text-2xl text-ink">{title}</div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-mist text-ink-2 text-2xl leading-none flex items-center justify-center">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** the results grid: a light grey tile per number */
export function StatGrid({ stats }: { stats: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {stats.map(([k, v]) => (
        <div key={k} className="rounded-xl bg-card px-3 py-2.5">
          <Label>{k}</Label>
          <div className="display text-xl">{v}</div>
        </div>
      ))}
    </div>
  );
}
