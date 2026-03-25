import React from 'react';
import type { UsageResponse } from '../types';

interface Props {
  usage:     UsageResponse;
  threshold: number;  // percentage 0-100 to show warning (default 80)
}

export function QuotaWarning({ usage, threshold = 80 }: Props) {
  const { quotas, credits } = usage;

  const warnings: string[] = [];

  const check = (label: string, used: number, limit: number) => {
    if (limit === Infinity) return;
    const pct = (used / limit) * 100;
    if (pct >= 100) warnings.push(`${label} limit reached (${used}/${limit})`);
    else if (pct >= threshold) warnings.push(`${label} at ${Math.round(pct)}% (${used}/${limit})`);
  };

  check('Generations',  quotas.generation.used,  quotas.generation.limit);
  check('Blueprints',   quotas.blueprint.used,   quotas.blueprint.limit);
  check('Solid Builds', quotas.solid_build.used,  quotas.solid_build.limit);
  check('Exports',      quotas.export.used,        quotas.export.limit);

  // Credits warning
  const creditPct = credits.maxBalance > 0 ? (credits.balance / credits.maxBalance) * 100 : 100;
  if (credits.balance === 0)    warnings.push('Credits exhausted — operations will be blocked');
  else if (creditPct <= 20)     warnings.push(`Credits low: ${credits.balance} remaining`);

  if (warnings.length === 0) return null;

  const isBlocked = warnings.some(w => w.includes('reached') || w.includes('exhausted'));

  return (
    <div style={{
      padding: '8px 10px', borderRadius: 8, fontSize: 10, lineHeight: 1.5,
      background: isBlocked ? 'rgba(248,113,113,0.07)' : 'rgba(251,146,60,0.07)',
      border: `1px solid ${isBlocked ? 'rgba(248,113,113,0.25)' : 'rgba(251,146,60,0.25)'}`,
      color: isBlocked ? '#f87171' : '#fb923c',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        {isBlocked ? '🚫 Limit Reached' : '⚠️ Quota Warning'}
      </div>
      {warnings.map((w, i) => <div key={i}>• {w}</div>)}
      {isBlocked && (
        <div style={{ marginTop: 6, opacity: 0.8 }}>
          Upgrade your plan or wait for the monthly reset.
        </div>
      )}
    </div>
  );
}
