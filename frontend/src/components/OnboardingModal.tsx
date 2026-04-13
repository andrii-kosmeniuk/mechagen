import React, { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3001';

const STEPS = [
  {
    id:    'welcome',
    icon:  '🚀',
    title: 'Welcome to MechaGen',
    desc:  'The AI-powered platform for generating validated 3D mechanical parts. Let\'s get you to your first result in under 2 minutes.',
    action: 'Get Started',
    tips:  [],
  },
  {
    id:    'choose_use_case',
    icon:  '🎯',
    title: 'What are you building?',
    desc:  'MechaGen works well for brackets, housings, mounts, flanges, gears, covers, and other discrete mechanical parts.',
    action: 'That\'s my use case →',
    tips:  ['3D printing prototypes', 'CNC machined parts', 'Sheet metal brackets', 'Motor mounts & fixtures'],
  },
  {
    id:    'explain_workflow',
    icon:  '🔬',
    title: 'How the pipeline works',
    desc:  'Describe your part → optional blueprint → AI generates spec + geometry → validation → export.',
    action: 'Got it →',
    tips:  [
      '✏️ Prompt: describe material, size, features',
      '📐 Blueprint: upload a drawing for exact dims',
      '✅ Validation: 8 checks run automatically',
      '🔧 Repair: issues auto-fixed when possible',
      '📦 Export: STL, OBJ, or GLB',
    ],
  },
  {
    id:    'first_project',
    icon:  '📁',
    title: 'Start with a sample prompt',
    desc:  'Copy one of these prompts into the generator to get your first result.',
    action: 'I\'m ready to generate →',
    tips:  [
      '"Aluminum mounting bracket, 80×60mm, 6mm thick, M4 bolt pattern, center hole 50mm"',
      '"Steel shaft collar, 25mm bore, 60mm OD, two M5 set screws, 20mm length"',
      '"Polycarbonate electronics enclosure, 120×80×40mm, 4 corner bosses, snap-fit lid"',
    ],
  },
  {
    id:    'reach_result',
    icon:  '🎉',
    title: 'You\'re all set!',
    desc:  'Head to the Design tab, paste a prompt, and click Generate. Your first part will be ready in seconds.',
    action: 'Start Generating →',
    tips:  [
      '💡 More specific prompts = better results',
      '📐 Blueprints dramatically improve accuracy',
      '🧱 Use Solid Build for manufacturing-ready output',
      '💳 Check the Billing tab for usage & credits',
    ],
  },
];

interface Props {
  userId?: string;
  onComplete?: () => void;
}

const s = {
  overlay: {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(8px)',
    zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  modal: {
    background: '#0d1424',
    border: '1px solid rgba(124,58,237,0.3)',
    borderRadius: 18,
    width: '100%',
    maxWidth: 480,
    padding: '36px 32px',
    position: 'relative' as const,
    boxShadow: '0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
  },
};

export function OnboardingModal({ userId, onComplete }: Props) {
  const [stepIdx, setStepIdx]       = useState(0);
  const [visible, setVisible]       = useState(false);
  const [advancing, setAdvancing]   = useState(false);

  // Show modal if user hasn't completed onboarding
  useEffect(() => {
    fetch(`${API}/api/me/onboarding`)
      .then(r => r.json())
      .then(data => {
        if (!data.onboarding?.completedAt) setVisible(true);
      })
      .catch(() => setVisible(true)); // show on error (new user assumed)
  }, []);

  if (!visible) return null;

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;
  const pct = Math.round(((stepIdx + 1) / STEPS.length) * 100);

  const advance = async () => {
    setAdvancing(true);
    try { await fetch(`${API}/api/me/onboarding/advance`, { method: 'POST' }); } catch {}
    if (isLast) {
      try { await fetch(`${API}/api/me/onboarding/complete`, { method: 'POST' }); } catch {}
      setVisible(false);
      onComplete?.();
    } else {
      setStepIdx(i => i + 1);
    }
    setAdvancing(false);
  };

  const skip = async () => {
    try { await fetch(`${API}/api/me/onboarding/skip`, { method: 'POST' }); } catch {}
    setVisible(false);
    onComplete?.();
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 28, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#7c3aed,#4f46e5)', borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>

        {/* Step counter */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7c3aed', marginBottom: 10 }}>
          STEP {stepIdx + 1} OF {STEPS.length}
        </div>

        {/* Icon + title */}
        <div style={{ fontSize: 38, marginBottom: 12 }}>{step.icon}</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.02em' }}>{step.title}</div>
        <div style={{ fontSize: 13, color: 'rgba(241,245,249,0.7)', lineHeight: 1.6, marginBottom: 20 }}>{step.desc}</div>

        {/* Tips */}
        {step.tips.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px', marginBottom: 22 }}>
            {step.tips.map((tip, i) => (
              <div key={i} style={{ fontSize: 12, color: 'rgba(241,245,249,0.65)', padding: '3px 0', lineHeight: 1.5 }}>{tip}</div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={advance}
            disabled={advancing}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff',
              opacity: advancing ? 0.7 : 1,
            }}
          >
            {advancing ? '…' : step.action}
          </button>
          <button
            onClick={skip}
            style={{ padding: '11px 16px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: 'rgba(241,245,249,0.4)' }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
