import React from 'react';
import type { Plan, Subscription, UsageResponse } from '../types';

interface Props {
  plan:         Plan | null;
  subscription: Subscription | null;
  usage:        UsageResponse | null;
  onUpgrade?:   () => void;
  devMode?:     boolean;
  onSetPlan?:   (code: string) => void;
}

const PLAN_BADGE_COLORS: Record<string, string> = {
  free:  '#64748b',
  pro:   '#a78bfa',
  team:  '#34d399',
  admin: '#f59e0b',
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  free:  'Basic access — perfect for experimenting.',
  pro:   'Higher limits, STL export, and priority builds.',
  team:  'Shared workspace, collaboration, and team usage visibility.',
  admin: 'Unrestricted platform access.',
};

const s = {
  card: {
    padding: '10px 12px', borderRadius: 8,
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
  } as React.CSSProperties,
  label: {
    fontSize: 9, fontWeight: 800, letterSpacing: '0.09em', color: 'var(--text-muted)',
  } as React.CSSProperties,
  badge: (code: string): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10,
    fontWeight: 800, letterSpacing: '0.07em',
    background: `${PLAN_BADGE_COLORS[code] ?? '#64748b'}22`,
    color: PLAN_BADGE_COLORS[code] ?? '#64748b',
    border: `1px solid ${PLAN_BADGE_COLORS[code] ?? '#64748b'}44`,
    textTransform: 'uppercase' as const,
  }),
  row: {
    display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0',
    color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.04)',
  } as React.CSSProperties,
  upgradeBtn: {
    width: '100%', marginTop: 8, padding: '7px 0', borderRadius: 7, border: 'none',
    cursor: 'pointer', fontSize: 11, fontWeight: 700,
    background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
    color: '#fff', letterSpacing: '0.04em',
  } as React.CSSProperties,
};

function LimitRow({ label, limit }: { label: string; limit: number }) {
  return (
    <div style={s.row}>
      <span>{label}</span>
      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
        {limit === Infinity ? '∞' : limit.toLocaleString()}
      </span>
    </div>
  );
}

export function BillingPanel({ plan, subscription, usage, onUpgrade, devMode, onSetPlan }: Props) {
  const code = plan?.code ?? 'free';
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Current plan header */}
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={s.label}>CURRENT PLAN</div>
          <span style={s.badge(code)}>{plan?.name ?? code}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
          {PLAN_DESCRIPTIONS[code] ?? ''}
        </div>
        {periodEnd && (
          <div style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.7 }}>
            Period ends {periodEnd}
          </div>
        )}
      </div>

      {/* Limits */}
      {plan && (
        <div style={s.card}>
          <div style={{ ...s.label, marginBottom: 6 }}>📋 MONTHLY LIMITS</div>
          <LimitRow label="Generations"  limit={plan.monthlyGenerationLimit} />
          <LimitRow label="Blueprints"   limit={plan.monthlyBlueprintLimit} />
          <LimitRow label="Solid Builds" limit={plan.monthlySolidBuildLimit} />
          <LimitRow label="Exports"      limit={plan.monthlyExportLimit} />
          <LimitRow label="Credits"      limit={plan.creditsPerMonth} />
          <LimitRow label="Team Members" limit={plan.workspaceMembers} />
        </div>
      )}

      {/* Features */}
      {plan && (
        <div style={s.card}>
          <div style={{ ...s.label, marginBottom: 6 }}>✨ FEATURES</div>
          {Object.entries({
            'STL Export':        plan.features.exportStl,
            'Priority Builds':   plan.features.prioritySolidBuild,
            'Team Workspace':    plan.features.teamWorkspace,
          }).map(([feat, enabled]) => (
            <div key={feat} style={{ ...s.row, color: enabled ? 'var(--text-secondary)' : 'var(--text-muted)', opacity: enabled ? 1 : 0.5 }}>
              <span>{enabled ? '✅' : '◻'} {feat}</span>
            </div>
          ))}
        </div>
      )}

      {/* Upgrade CTA */}
      {code !== 'admin' && code !== 'team' && (
        <button style={s.upgradeBtn} onClick={onUpgrade}>
          ⚡ Upgrade Plan
        </button>
      )}

      {/* Dev quick-switch */}
      {devMode && onSetPlan && (
        <div style={s.card}>
          <div style={{ ...s.label, marginBottom: 6 }}>🛠 DEV: SWITCH PLAN</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
            {(['free', 'pro', 'team', 'admin'] as const).map(c => (
              <button
                key={c}
                onClick={() => onSetPlan(c)}
                style={{
                  padding: '4px 8px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: 9, fontWeight: 700,
                  background: code === c ? PLAN_BADGE_COLORS[c] : 'rgba(255,255,255,0.05)',
                  color: code === c ? '#fff' : 'var(--text-muted)',
                }}
              >{c}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
