import React from 'react';

const PLANS = [
  {
    id:       'free',
    name:     'Free',
    price:    0,
    desc:     'Personal projects and exploration.',
    features: [
      { label: '10 generations / month', on: true },
      { label: '3 blueprints / month',   on: true },
      { label: 'OBJ + GLB export',       on: true },
      { label: '2 solid builds / month', on: true },
      { label: '20 credits / month',     on: true },
      { label: 'STL export',             on: false },
      { label: 'Team workspace',         on: false },
    ],
  },
  {
    id:       'pro',
    name:     'Pro',
    price:    29,
    desc:     'Individual engineers and serious makers.',
    popular:  true,
    features: [
      { label: '100 generations / month', on: true },
      { label: '30 blueprints / month',   on: true },
      { label: 'STL + OBJ + GLB export',  on: true },
      { label: '20 solid builds / month', on: true },
      { label: '500 credits / month',     on: true },
      { label: 'Priority generation',     on: true },
      { label: 'Team workspace',          on: false },
    ],
  },
  {
    id:       'team',
    name:     'Team',
    price:    99,
    desc:     'Teams collaborating on mechanical design.',
    features: [
      { label: '500 generations / month', on: true },
      { label: '150 blueprints / month',  on: true },
      { label: 'All export formats',      on: true },
      { label: '100 solid builds / month',on: true },
      { label: '2000 credits / month',    on: true },
      { label: 'Team workspace + RBAC',   on: true },
      { label: 'Admin visibility',        on: true },
    ],
  },
];

interface Props {
  currentPlanId?: string;
  onUpgrade?: (planId: string) => void;
  compact?: boolean;
}

export function PricingPage({ currentPlanId, onUpgrade, compact = false }: Props) {
  const s: Record<string, React.CSSProperties> = {
    wrap:    { display: 'flex', flexDirection: 'column', gap: compact ? 10 : 16 },
    grid:    { display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 },
    card:    { borderRadius: 12, padding: compact ? '16px 14px' : '22px 18px', background: 'var(--input-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))', position: 'relative' },
    popular: { borderColor: '#7c3aed', background: 'rgba(124,58,237,0.07)' },
    badge:   { position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#7c3aed', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap' as const },
    name:    { fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' as const, marginBottom: 6 },
    price:   { fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 2 },
    priceS:  { fontSize: 12, fontWeight: 500, color: 'var(--text-muted, #64748b)' },
    desc:    { fontSize: 11, color: 'var(--text-muted, #64748b)', marginBottom: 12, lineHeight: 1.5 },
    feat:    { fontSize: 11, padding: '4px 0', borderBottom: '1px solid var(--border, rgba(255,255,255,0.06))', display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text-muted, #64748b)' },
    check:   { color: '#10b981', fontWeight: 800, flexShrink: 0 },
    cross:   { color: '#475569', flexShrink: 0 },
    cta:     { display: 'block', textAlign: 'center' as const, marginTop: 14, padding: '9px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit', width: '100%' },
    ctaPri:  { background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff' },
    ctaGhost:{ background: 'transparent', color: 'var(--text-muted, #64748b)', border: '1px solid var(--border, rgba(255,255,255,0.1))' },
    ctaCurr: { background: 'transparent', color: '#10b981', border: '1px solid #10b981' },
  };

  return (
    <div style={s.wrap}>
      {!compact && (
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7c3aed', marginBottom: 8 }}>PRICING</div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>Choose your plan</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>Start free. Upgrade anytime.</div>
        </div>
      )}
      <div style={s.grid}>
        {PLANS.map(plan => {
          const isCurrent = currentPlanId === plan.id;
          return (
            <div key={plan.id} style={{ ...s.card, ...(plan.popular ? s.popular : {}) }}>
              {plan.popular && <div style={s.badge}>⚡ POPULAR</div>}
              <div style={s.name}>{plan.name}</div>
              <div style={s.price}>
                ${plan.price} <span style={s.priceS}>/ mo</span>
              </div>
              <div style={s.desc}>{plan.desc}</div>
              {plan.features.map((f, i) => (
                <div key={i} style={s.feat}>
                  <span style={f.on ? s.check : s.cross}>{f.on ? '✓' : '✗'}</span>
                  {f.label}
                </div>
              ))}
              <button
                style={{ ...s.cta, ...(isCurrent ? s.ctaCurr : plan.popular ? s.ctaPri : s.ctaGhost) }}
                onClick={() => !isCurrent && onUpgrade?.(plan.id)}
                disabled={isCurrent}
              >
                {isCurrent ? '✓ Current Plan' : plan.id === 'free' ? 'Downgrade' : `Upgrade to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted, #64748b)', textAlign: 'center' }}>All plans include validation, repair, and the preview pipeline. Cancel anytime.</div>
    </div>
  );
}
