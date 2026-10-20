// Building blocks in the list.am style: flat white surfaces, hairline borders, grey secondary
// buttons, one blue for the main action, outline icons.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { X } from 'lucide-react';

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

type Variant = 'primary' | 'secondary' | 'ghost' | 'alert';
const VARIANTS: Record<Variant, string> = {
  // "Post an Ad"
  primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-faint',
  // "Add new vehicle"
  secondary: 'bg-mist text-ink hover:bg-line disabled:text-faint disabled:hover:bg-mist',
  ghost: 'bg-transparent text-ink-2 hover:bg-mist hover:text-ink disabled:text-faint',
  alert: 'bg-alert text-white hover:brightness-95',
};
const SIZES = { sm: 'text-[13px] px-3 h-8 gap-1.5', md: 'text-[15px] px-4 h-10 gap-2', lg: 'text-base px-6 h-11 gap-2' };

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
      className={`inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed ${pill ? 'rounded-full' : 'rounded-[10px]'} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}

/** a square icon button (header tools, sheet close) */
export function IconButton({ children, className = '', active = false, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button {...rest} className={`inline-flex items-center justify-center w-9 h-9 rounded-[10px] transition-colors ${active ? 'bg-badge text-brand' : 'text-ink hover:bg-mist'} ${className}`}>
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'brand', className = '' }: { children: ReactNode; tone?: 'brand' | 'alert' | 'grey'; className?: string }) {
  const t = { brand: 'bg-badge text-brand', alert: 'bg-alert text-white', grey: 'bg-mist text-ink-2' }[tone];
  return <span className={`inline-flex items-center rounded-md px-2 h-6 text-[13px] font-medium ${t} ${className}`}>{children}</span>;
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`text-[13px] text-ink-2 ${className}`}>{children}</div>;
}

/** a thin progress bar: ink by default, red when it is bad news */
export function Bar({ value, tone = 'ink', className = 'w-40' }: { value: number; tone?: 'ink' | 'brand' | 'alert'; className?: string }) {
  const c = { ink: 'bg-ink', brand: 'bg-brand', alert: 'bg-alert' }[tone];
  return (
    <div className={`h-1 bg-line rounded-full overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${c} transition-all`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

/** coins: an outline coin and the number */
export function Coins({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium tabular-nums ${className}`}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4.6v6.8M9.8 6.2c0-.7-.8-1.2-1.8-1.2s-1.8.5-1.8 1.2c0 1.6 3.6.9 3.6 2.6 0 .8-.8 1.3-1.8 1.3s-1.8-.5-1.8-1.3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      {fmt(n)}
    </span>
  );
}

/** the game's mark: an outline steering wheel in list.am blue */
export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="#0077ff" strokeWidth="3.2" />
      <circle cx="16" cy="16" r="3" fill="none" stroke="#0077ff" strokeWidth="3" />
      <path d="M4.5 13.6h8.6M18.9 13.6h8.6M16 19v9" stroke="#0077ff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ size = 'text-xl', mark = 30 }: { size?: string; mark?: number }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <Mark size={mark} />
      <span className={`font-bold tracking-tight ${size} leading-none text-ink`}>
        MyGarage <span className="font-semibold text-ink-2">Drive</span>
      </span>
    </div>
  );
}

/** a modal in the list.am style: white, rounded, title and a close button */
export function Sheet({ title, children, onClose, id, wide = false }: { title: string; children: ReactNode; onClose: () => void; id: string; wide?: boolean }) {
  return (
    <div className="absolute inset-0 bg-night/40 pointer-events-auto flex justify-center overflow-y-auto p-4 rise" data-modal onClick={onClose}>
      <div id={id} className={`w-full my-auto ${wide ? 'max-w-2xl' : 'max-w-[480px]'} bg-paper rounded-2xl float p-6 flex flex-col gap-5`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4">
          <div className="text-xl font-bold">{title}</div>
          <IconButton onClick={onClose} aria-label="Close" className="-mr-2">
            <X size={20} strokeWidth={1.6} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

/** the grey detail panel of white tiles, as on a Garage card */
export function Tiles({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={`rounded-xl bg-tile p-2 grid gap-2 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>{children}</div>;
}

export function Tile({ label, value, id, className = '' }: { label: string; value: ReactNode; id?: string; className?: string }) {
  return (
    <div className={`rounded-[10px] bg-paper border border-line px-3 py-2 min-w-0 ${className}`}>
      <div className="text-[12px] text-ink-2 truncate">{label}</div>
      <div id={id} className="font-semibold text-[15px] tabular-nums truncate">
        {value}
      </div>
    </div>
  );
}

/** the results grid */
export function StatGrid({ stats }: { stats: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-xl bg-tile p-2">
      {stats.map(([k, v]) => (
        <Tile key={k} label={k} value={v} />
      ))}
    </div>
  );
}
