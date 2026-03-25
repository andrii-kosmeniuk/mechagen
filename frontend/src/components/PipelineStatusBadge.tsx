import React from 'react';
import type { GenerationStatus } from '../types';

const STATUS_CONFIG: Record<GenerationStatus, { label: string; color: string; dot: string }> = {
  queued:             { label: 'Queued',           color: '#7eb8f7', dot: '#7eb8f7' },
  spec_generating:    { label: 'Reading Prompt…',  color: '#a78bfa', dot: '#a78bfa' },
  constraint_checking:{ label: 'Checking…',        color: '#c4b5fd', dot: '#c4b5fd' },
  planning:           { label: 'Planning…',        color: '#60a5fa', dot: '#60a5fa' },
  building_preview:   { label: 'Building…',        color: '#34d399', dot: '#34d399' },
  building_solid:     { label: 'Solid Build…',     color: '#10b981', dot: '#10b981' },
  validating:         { label: 'Validating…',      color: '#fbbf24', dot: '#fbbf24' },
  repairing:          { label: 'Repairing…',       color: '#f59e0b', dot: '#f59e0b' },
  ready:              { label: 'Ready',            color: '#4ade80', dot: '#4ade80' },
  failed:             { label: 'Failed',           color: '#f87171', dot: '#f87171' },
};

const ANIMATED = new Set<GenerationStatus>([
  'queued','spec_generating','constraint_checking','planning',
  'building_preview','building_solid','validating','repairing',
]);

interface Props {
  status: GenerationStatus;
  small?: boolean;
}

export function PipelineStatusBadge({ status, small }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued;
  const isAnimated = ANIMATED.has(status);

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: small ? '2px 8px' : '4px 10px',
      borderRadius: 20,
      fontSize: small ? 10 : 11,
      fontWeight: 700,
      letterSpacing: '0.06em',
      background: `${cfg.color}18`,
      border: `1px solid ${cfg.color}44`,
      color: cfg.color,
    }}>
      <span style={{
        width: small ? 6 : 7,
        height: small ? 6 : 7,
        borderRadius: '50%',
        background: cfg.dot,
        flexShrink: 0,
        animation: isAnimated ? 'pulse-dot 1.2s ease-in-out infinite' : undefined,
      }} />
      {cfg.label}
      <style>{`@keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </span>
  );
}
