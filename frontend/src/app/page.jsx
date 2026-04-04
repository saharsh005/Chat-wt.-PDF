'use client';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #0f0f0f;
          --bg-2: #141414;
          --bg-3: #1a1a1a;
          --border: rgba(255,255,255,0.07);
          --border-hover: rgba(255,255,255,0.13);
          --text-primary: #f0ede8;
          --text-secondary: #8a8680;
          --text-muted: #4a4845;
          --accent: #c9a96e;
          --accent-dim: rgba(201,169,110,0.12);
          --accent-border: rgba(201,169,110,0.25);
          --blue: #7b9fd4;
          --blue-dim: rgba(123,159,212,0.1);
        }

        .land {
          min-height: 100vh;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          font-family: 'DM Sans', sans-serif;
          color: var(--text-primary);
          position: relative;
          overflow: hidden;
        }

        /* Subtle noise texture overlay */
        .land::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
          opacity: 0.6;
        }

        /* Ambient glow */
        .land-ambient {
          position: absolute;
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: 900px;
          height: 600px;
          background: radial-gradient(
            ellipse at center,
            rgba(201,169,110,0.04) 0%,
            rgba(123,159,212,0.03) 40%,
            transparent 70%
          );
          pointer-events: none;
          z-index: 1;
        }

        /* Nav */
        .land-nav {
          position: relative;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 48px;
          border-bottom: 1px solid var(--border);
          backdrop-filter: blur(10px);
        }

        .land-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
        }

        .land-logo-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .land-logo-icon svg {
          width: 28px;
          height: 28px;
        }

        .land-logo-name {
          font-family: 'DM Serif Display', serif;
          font-size: 18px;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .land-nav-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* Buttons */
        .btn-ghost {
          padding: 8px 16px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all 0.18s ease;
          letter-spacing: 0;
        }

        .btn-ghost:hover {
          border-color: var(--border-hover);
          color: var(--text-primary);
          background: rgba(255,255,255,0.03);
        }

        .btn-accent {
          padding: 8px 18px;
          background: var(--accent);
          border: 1px solid transparent;
          border-radius: 8px;
          color: #0f0f0f;
          font-size: 13px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all 0.18s ease;
          letter-spacing: 0;
        }

        .btn-accent:hover {
          background: #d4b478;
          box-shadow: 0 4px 20px rgba(201,169,110,0.2);
        }

        /* Hero */
        .land-hero {
          position: relative;
          z-index: 10;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 100px 24px 60px;
          text-align: center;
        }

        .land-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--accent);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 28px;
          opacity: 0;
          animation: fadeUp 0.6s ease 0.1s forwards;
        }

        .land-eyebrow-line {
          width: 24px;
          height: 1px;
          background: var(--accent);
          opacity: 0.6;
        }

        .land-h1 {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(40px, 6.5vw, 76px);
          font-weight: 400;
          line-height: 1.06;
          letter-spacing: -0.025em;
          color: var(--text-primary);
          margin-bottom: 6px;
          opacity: 0;
          animation: fadeUp 0.7s ease 0.2s forwards;
        }

        .land-h1-italic {
          font-style: italic;
          color: var(--accent);
        }

        .land-h1-line2 {
          opacity: 0;
          animation: fadeUp 0.7s ease 0.32s forwards;
          display: block;
        }

        .land-sub {
          font-size: 15px;
          color: var(--text-secondary);
          line-height: 1.7;
          max-width: 480px;
          margin: 24px auto 40px;
          font-weight: 300;
          opacity: 0;
          animation: fadeUp 0.7s ease 0.44s forwards;
        }

        .land-cta {
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          opacity: 0;
          animation: fadeUp 0.7s ease 0.56s forwards;
        }

        .btn-cta-primary {
          padding: 13px 28px;
          background: var(--text-primary);
          border: none;
          border-radius: 10px;
          color: var(--bg);
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all 0.2s ease;
          letter-spacing: -0.01em;
        }

        .btn-cta-primary:hover {
          background: #fff;
          box-shadow: 0 8px 30px rgba(240,237,232,0.15);
          transform: translateY(-1px);
        }

        .btn-cta-secondary {
          padding: 13px 24px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 400;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-cta-secondary:hover {
          border-color: var(--border-hover);
          color: var(--text-primary);
        }

        /* Divider */
        .land-divider {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 0 48px;
          margin-bottom: 40px;
          opacity: 0;
          animation: fadeIn 1s ease 0.8s forwards;
        }

        .land-divider-line {
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        .land-divider-text {
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        /* Feature cards — notebook-style */
        .land-features {
          position: relative;
          z-index: 10;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1px;
          margin: 0 48px 64px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          opacity: 0;
          animation: fadeIn 0.9s ease 0.95s forwards;
        }

        .land-feat {
          background: var(--bg-2);
          padding: 32px 28px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: background 0.2s ease;
          cursor: default;
        }

        .land-feat:hover {
          background: var(--bg-3);
        }

        .land-feat-num {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .land-feat-title {
          font-family: 'DM Serif Display', serif;
          font-size: 17px;
          font-weight: 400;
          color: var(--text-primary);
          line-height: 1.3;
          letter-spacing: -0.01em;
        }

        .land-feat-desc {
          font-size: 12.5px;
          color: var(--text-secondary);
          line-height: 1.65;
          font-weight: 300;
        }

        .land-feat-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-top: 4px;
          padding: 4px 10px;
          background: var(--accent-dim);
          border: 1px solid var(--accent-border);
          border-radius: 20px;
          font-size: 10.5px;
          color: var(--accent);
          font-weight: 500;
          letter-spacing: 0.02em;
          width: fit-content;
        }

        /* Footer */
        .land-footer {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 48px;
          border-top: 1px solid var(--border);
          font-size: 11.5px;
          color: var(--text-muted);
        }

        .land-footer-links {
          display: flex;
          gap: 20px;
        }

        .land-footer-links a {
          color: var(--text-muted);
          text-decoration: none;
          transition: color 0.15s;
        }

        .land-footer-links a:hover {
          color: var(--text-secondary);
        }

        /* Animations */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* Responsive */
        @media (max-width: 640px) {
          .land-nav { padding: 16px 20px; }
          .land-features { margin: 0 20px 48px; }
          .land-divider { padding: 0 20px; }
          .land-footer { padding: 16px 20px; flex-direction: column; gap: 10px; text-align: center; }
        }
      `}</style>

      <div className="land">
        <div className="land-ambient" />

        {/* Nav */}
        <nav className="land-nav">
          <div className="land-logo">
            <div className="land-logo-icon">
              {/* Book/document icon — no R logo */}
              <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="4" width="14" height="20" rx="2" stroke="#c9a96e" strokeWidth="1.4" fill="none"/>
                <rect x="9" y="4" width="14" height="20" rx="2" stroke="rgba(201,169,110,0.35)" strokeWidth="1.4" fill="rgba(201,169,110,0.04)"/>
                <line x1="12" y1="10" x2="19" y2="10" stroke="#c9a96e" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
                <line x1="12" y1="14" x2="19" y2="14" stroke="#c9a96e" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
                <line x1="12" y1="18" x2="16" y2="18" stroke="#c9a96e" strokeWidth="1.2" strokeLinecap="round" opacity="0.35"/>
              </svg>
            </div>
            <span className="land-logo-name">Radium</span>
          </div>

          <div className="land-nav-actions">
            <SignedIn>
              <button className="btn-ghost" onClick={() => router.push('/workspace')}>
                Dashboard
              </button>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal" redirectUrl="/workspace">
                <button className="btn-ghost">Sign in</button>
              </SignInButton>
              <SignInButton mode="modal" redirectUrl="/workspace">
                <button className="btn-accent">Get started</button>
              </SignInButton>
            </SignedOut>
          </div>
        </nav>

        {/* Hero */}
        <section className="land-hero">
          <div className="land-eyebrow">
            <span className="land-eyebrow-line" />
            Research AI
            <span className="land-eyebrow-line" />
          </div>

          <h1 className="land-h1">
            Your research,
            <span className="land-h1-italic"> deeply</span>
            <span className="land-h1-line2">understood</span>
          </h1>

          <p className="land-sub">
            Upload your papers and get answers with precision-linked citations.
            Discover research gaps, synthesise across documents, and augment with live web sources.
          </p>

          <div className="land-cta">
            <SignedOut>
              <SignInButton mode="modal" redirectUrl="/workspace">
                <button className="btn-cta-primary">Start for free</button>
              </SignInButton>
              <button className="btn-cta-secondary">See how it works →</button>
            </SignedOut>
            <SignedIn>
              <button className="btn-cta-primary" onClick={() => router.push('/workspace')}>
                Open workspace →
              </button>
            </SignedIn>
          </div>
        </section>

        {/* Divider */}
        <div className="land-divider">
          <div className="land-divider-line" />
          <span className="land-divider-text">Capabilities</span>
          <div className="land-divider-line" />
        </div>

        {/* Feature grid */}
        <div className="land-features">
          {[
            {
              num: '01',
              title: 'Multi-document workspace',
              desc: 'Upload 1–10 PDFs per workspace. Every answer is grounded across all documents simultaneously.',
              tag: 'RAG · Multi-PDF',
            },
            {
              num: '02',
              title: 'Clickable citations',
              desc: 'Each AI response surfaces source chips. Click any citation to jump to the exact page in the PDF viewer.',
              tag: 'Page-level precision',
            },
            {
              num: '03',
              title: 'Research gap analysis',
              desc: 'Automatically surfaces methodological, theoretical and empirical gaps across your entire corpus.',
              tag: 'Gap detection',
            },
            {
              num: '04',
              title: 'Internet-augmented mode',
              desc: 'Switch to web mode: extracts keywords, queries CrossRef & Semantic Scholar, then synthesises findings.',
              tag: 'Live web · CrossRef',
            },
          ].map(f => (
            <div key={f.num} className="land-feat">
              <div className="land-feat-num">{f.num}</div>
              <div className="land-feat-title">{f.title}</div>
              <div className="land-feat-desc">{f.desc}</div>
              <div className="land-feat-tag">{f.tag}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="land-footer">
          <span>© {new Date().getFullYear()} Radium · Built for academic research</span>
          <div className="land-footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </div>
        </footer>
      </div>
    </>
  );
}