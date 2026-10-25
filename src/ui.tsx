import type { PublicPlayer } from '../lib/types';

export const COLORS = ['#e4472b', '#f4b836', '#1d7a6b', '#4a63d8', '#9a55ad', '#7fae3d', '#ef82ab', '#ea8a2d'];

export function Chip({ p, size = 'md', muted = false }: { p: Pick<PublicPlayer, 'name' | 'color'>; size?: 'sm' | 'md' | 'lg'; muted?: boolean }) {
  return (
    <span className={`chip chip-${size}${muted ? ' chip-muted' : ''}`} style={{ background: COLORS[p.color % COLORS.length] }} aria-hidden="true">
      {p.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function PromptText({ text, fill }: { text: string; fill?: string }) {
  const [before, after = ''] = text.split('______');
  return (
    <>
      {before}
      <span className={`blank${fill ? ' filled' : ''}`}>{fill ?? '\u00a0'}</span>
      {after}
    </>
  );
}

export function TimerBar({ secs, total }: { secs: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (secs / total) * 100)) : 0;
  const urgent = secs <= 10;
  return (
    <div className={`timer${urgent ? ' urgent' : ''}`} role="timer" aria-label={`${Math.ceil(secs)} seconds left`}>
      <div className="timer-track">
        <div className="timer-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="timer-num">{Math.ceil(Math.max(0, secs))}</span>
    </div>
  );
}

export const money = (n: number) => n.toLocaleString('en-US');
