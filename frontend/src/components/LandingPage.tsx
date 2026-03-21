import React, { useEffect, useRef, useState } from 'react';
import { HeroCanvas } from './HeroCanvas';

type Props = {
  onSignIn: () => void;
  onGetStarted: () => void;
};

type PricingTier = 'free' | 'pro' | 'enterprise';

export function LandingPage({ onSignIn, onGetStarted }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  /** Pro selected + orange CTA by default until user picks another plan. */
  const [activeTier, setActiveTier] = useState<PricingTier>('pro');

  const ctaButtonClass = (tier: PricingTier) =>
    `btn-lg ${activeTier === tier ? 'btn-orange' : 'btn-pricing-navy'}`;

  const ctaClick = (tier: PricingTier) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTier(tier);
    onGetStarted();
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sections = root.querySelectorAll('.preview-section');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-root" ref={rootRef}>
      <nav className="preview-nav">
        <div className="logo">
          <span style={{ color: 'var(--accent-blue)' }}>⬡</span> MECHAGEN PRO
        </div>
        <div className="cta-group">
          <button type="button" className="btn-outline btn-lg" onClick={onSignIn}>
            Sign In
          </button>
          <button type="button" className="btn-orange btn-lg" onClick={onGetStarted}>
            Get Started
          </button>
        </div>
      </nav>

      <section className="hero">
        <HeroCanvas />
        <div className="hero-content">
          <div className="logo-glow">⬡ MECHAGEN PRO</div>
          <h1>AI-Powered 3D Mechanical Parts Generator</h1>
          <p>
            Design, analyze, and export precision mechanical components with multi-agent AI
            co-pilots.
          </p>
          <div className="cta-group">
            <button type="button" className="btn-orange btn-lg" onClick={onGetStarted}>
              Get Started Free
            </button>
            <button type="button" className="btn-outline btn-lg" disabled title="Coming soon">
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      <section className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">10,000+</span>
          <span className="stat-label">Parts Generated</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">&lt; 3s</span>
          <span className="stat-label">Avg. Generation Time</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">OBJ · STL</span>
          <span className="stat-label">Universal Export</span>
        </div>
      </section>

      <section className="preview-section" id="features">
        <div className="section-header">
          <h2>Engineered for Precision</h2>
          <p>The most advanced AI pipeline for mechanical engineering.</p>
        </div>
        <div className="features-grid">
          {[
            {
              icon: '⚡',
              title: 'Multi-Agent AI',
              text: 'Parallel AI agents collaborate to generate complex assemblies and optimized geometries.',
            },
            {
              icon: '🔬',
              title: 'Engineering Analysis',
              text: 'FMEA, failure prediction, and tolerance stack-up analysis in seconds, not hours.',
            },
            {
              icon: '📐',
              title: 'Parametric Design',
              text: 'Live sliders rebuild geometry in real-time with our integrated Three.js engine.',
            },
            {
              icon: '🌐',
              title: 'Real-Time Collab',
              text: 'WebSocket-powered live co-editing with presence avatars and version history.',
            },
            {
              icon: '📦',
              title: 'Universal Export',
              text: 'Download production-ready OBJ, STL, and 2D technical drawings instantly.',
            },
            {
              icon: '🤖',
              title: 'AI Copilot',
              text: 'Context-aware suggestions and autonomous design mode for rapid prototyping.',
            },
          ].map((f) => (
            <div key={f.title} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="preview-section" id="workflow">
        <div className="section-header">
          <h2>How it Works</h2>
          <p>From concept to production in four simple steps.</p>
        </div>
        <div className="workflow-timeline">
          {[
            { n: '1', t: 'Describe', p: 'Write a prompt or use voice input.' },
            { n: '2', t: 'Generate', p: 'AI creates geometry with multi-agent pipeline.' },
            { n: '3', t: 'Analyze', p: 'Run stress, FMEA, and manufacturing checks.' },
            { n: '4', t: 'Export', p: 'Download STL/OBJ or share a link.' },
          ].map((s) => (
            <div key={s.n} className="workflow-step">
              <div className="step-num">{s.n}</div>
              <h3>{s.t}</h3>
              <p>{s.p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="preview-section" id="pricing">
        <div className="section-header">
          <h2>Simple Pricing</h2>
          <p>Choose the plan that fits your engineering needs.</p>
        </div>
        <div className="pricing-grid">
          <div
            className={`pricing-card${activeTier === 'free' ? ' pricing-card--selected' : ''}`}
            onClick={() => setActiveTier('free')}
          >
            <h3>Free</h3>
            <div className="price">
              $0<span>/mo</span>
            </div>
            <ul className="pricing-features">
              <li>3 free generations</li>
              <li>OBJ export</li>
              <li>Basic analysis</li>
              <li>Community support</li>
            </ul>
            <button type="button" className={ctaButtonClass('free')} onClick={ctaClick('free')}>
              Get Started
            </button>
          </div>
          <div
            className={`pricing-card${activeTier === 'pro' ? ' pricing-card--selected' : ''}`}
            onClick={() => setActiveTier('pro')}
          >
            <h3>Pro</h3>
            <div className="price">
              $200<span>/mo</span>
            </div>
            <ul className="pricing-features">
              <li>Unlimited generations</li>
              <li>All export formats</li>
              <li>Advanced FMEA</li>
              <li>Real-time collaboration</li>
              <li>Priority support</li>
            </ul>
            <button type="button" className={ctaButtonClass('pro')} onClick={ctaClick('pro')}>
              Start Free Trial
            </button>
          </div>
          <div
            className={`pricing-card${activeTier === 'enterprise' ? ' pricing-card--selected' : ''}`}
            onClick={() => setActiveTier('enterprise')}
          >
            <h3>Enterprise</h3>
            <div className="price">Custom</div>
            <ul className="pricing-features">
              <li>Custom quota</li>
              <li>Team management</li>
              <li>API access</li>
              <li>SSO & Security</li>
              <li>Dedicated account manager</li>
            </ul>
            <button
              type="button"
              className={ctaButtonClass('enterprise')}
              onClick={ctaClick('enterprise')}
            >
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      <footer className="preview-footer">
        <div className="logo">
          <span style={{ color: 'var(--accent-blue)' }}>⬡</span> MECHAGEN PRO
        </div>
        <p style={{ marginTop: '1rem' }}>Built with Three.js · Powered by Multi-Agent AI</p>
        <div className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Docs</a>
          <a href="#">Contact</a>
        </div>
        <p style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.5 }}>
          &copy; {new Date().getFullYear()} MechaGen Pro. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
