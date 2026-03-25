import React from 'react';
import type { UsageResponse } from '../types';

interface QuotaRowProps {
  label:    string;
  icon:     string;
  used:     number;
  limit:    number;
}

function QuotaRow({ label, icon, used, limit }: QuotaRowProps) {
  const pct     = limit === Infinity ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const isHigh  = pct >= 80;
  const isOver  = used >= limit && limit !== Infinity;
  const color   = isOver ? '#f87171' : isHigh ? '#fb923c' : '#4ade80';
  const infLimit = limit === Infinity;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-muted)' }}>{icon} {label}</span>
        <span style={{ fontWeight: 700, color: isOver ? '#f87171' : 'var(--text-secondary)' }}>
          {used}{infLimit ? '' : ` / ${limit}`}
        </span>
      </div>
      {!infLimit && (
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>
      )}
    </div>
  );
}

interface Props { usage: UsageResponse }

const s = {
  card: {
    padding: '12px 14px', borderRadius: 10,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  } as React.CSSProperties,
  title: {
    fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
    color: 'var(--text-muted)', marginBottom: 10,
  } as React.CSSProperties,
};

export function UsageDashboard({ usage }: Props) {
  const { quotas, credits, plan: planInfo } = usage;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Credits */}
      <div style={s.card}>
        <div style={s.title}>⚡ CREDITS THIS MONTH</div>
        <QuotaRow label="Available"  icon="" used={credits.maxBalance - credits.balance} limit={credits.maxBalance} />
        <div style={{ fontSize: 11, fontWeight: 700, color: credits.balance < 10 ? '#f87171' : '#a78bfa', marginTop: 4 }}>
          {credits.balance} credits remaining
        </div>
      </div>

      {/* Quota bars */}
      <div style={s.card}>
        <div style={s.title}>📊 MONTHLY USAGE</div>
        <QuotaRow label="Generations"   icon="🔬" used={quotas.generation.used}  limit={quotas.generation.limit} />
        <QuotaRow label="Blueprints"    icon="📐" used={quotas.blueprint.used}   limit={quotas.blueprint.limit} />
        <QuotaRow label="Solid Builds"  icon="🧱" used={quotas.solid_build.used} limit={quotas.solid_build.limit} />
        <QuotaRow label="Exports"       icon="📦" used={quotas.export.used}      limit={quotas.export.limit} />
      </div>
    </div>
  );
}
