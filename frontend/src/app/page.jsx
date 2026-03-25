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
        .land {
          min-height: 100vh;
          background: #080808;
          display: flex;
          flex-direction: column;
          font-family: 'Inter', -apple-system, sans-serif;
          color: #e2e2e2;
          position: relative;
          overflow: hidden;
        }
        .land-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }
        .land-glow {
          position: absolute;
          top: -120px; left: 50%; transform: translateX(-50%);
          width: 700px; height: 400px;
          background: radial-gradient(ellipse, rgba(100,149,237,0.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .land-nav {
          position: relative; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 40px;
          border-bottom: 1px solid #111;
        }
        .land-logo {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none;
        }
        .land-logo-mark {
          width: 32px; height: 32px; border-radius: 9px;
          background: linear-gradient(135deg, #6495ed, #8b67d4);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: #fff;
        }
        .land-logo-text {
          font-size: 15px; font-weight: 700; color: #e2e2e2; letter-spacing: -0.01em;
        }
        .land-logo-sub {
          font-size: 9px; color: #444; letter-spacing: 0.12em; text-transform: uppercase;
        }
        .land-hero {
          position: relative; z-index: 5;
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 80px 24px 60px;
          text-align: center;
          gap: 0;
        }
        .land-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(100,149,237,0.08);
          border: 1px solid rgba(100,149,237,0.2);
          border-radius: 20px; padding: 5px 14px;
          font-size: 11px; color: #6495ed; font-weight: 500; letter-spacing: 0.06em;
          text-transform: uppercase; margin-bottom: 32px;
        }
        .land-dot { width: 5px; height: 5px; border-radius: 50%; background: #6495ed; }
        .land-h1 {
          font-size: clamp(36px, 6vw, 68px);
          font-weight: 700; letter-spacing: -0.03em; line-height: 1.08;
          color: #f0f0f0; margin-bottom: 20px;
        }
        .land-h1 span {
          background: linear-gradient(135deg, #6495ed, #a78bfa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .land-sub {
          font-size: 16px; color: #666; line-height: 1.65;
          max-width: 520px; margin-bottom: 44px;
        }
        .land-btns { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: center; }
        .btn-primary {
          padding: 12px 28px;
          background: linear-gradient(135deg, #6495ed, #8b67d4);
          border: none; border-radius: 10px;
          color: #fff; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: all 0.2s ease;
          letter-spacing: -0.01em;
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 32px rgba(100,149,237,0.3); }
        .btn-secondary {
          padding: 12px 28px;
          background: transparent;
          border: 1px solid #222; border-radius: 10px;
          color: #aaa; font-size: 14px; font-weight: 500;
          cursor: pointer; transition: all 0.2s ease;
        }
        .btn-secondary:hover { border-color: #444; color: #e2e2e2; }
        .land-features {
          position: relative; z-index: 5;
          display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1px; margin: 0 40px 60px;
          border: 1px solid #111; border-radius: 16px; overflow: hidden;
        }
        .land-feat {
          background: #0d0d0d; padding: 28px 24px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .land-feat-icon {
          width: 36px; height: 36px; border-radius: 9px;
          background: rgba(100,149,237,0.1); border: 1px solid rgba(100,149,237,0.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
        }
        .land-feat-title { font-size: 13px; font-weight: 600; color: #e2e2e2; }
        .land-feat-desc { font-size: 12px; color: #555; line-height: 1.55; }
        .land-footer {
          position: relative; z-index: 5;
          text-align: center; padding: 20px;
          font-size: 11px; color: #333; border-top: 1px solid #111;
        }
      `}</style>

      <div className="land">
        <div className="land-grid" />
        <div className="land-glow" />

        {/* Nav */}
        <nav className="land-nav">
          <div className="land-logo">
            <div className="land-logo-mark">R</div>
            <div>
              <div className="land-logo-text">Radium</div>
              <div className="land-logo-sub">Research AI</div>
            </div>
          </div>
          <SignedIn>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn-secondary" style={{ padding: '8px 18px', fontSize: 13 }}
                onClick={() => router.push('/workspace')}>
                Dashboard
              </button>
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal" redirectUrl="/workspace">
              <button className="btn-secondary" style={{ padding: '8px 18px', fontSize: 13 }}>
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
        </nav>

        {/* Hero */}
        <section className="land-hero">
          <div className="land-badge">
            <div className="land-dot" />
            Multi-document RAG · Citation tracking · Research gaps
          </div>
          <h1 className="land-h1">
            Research intelligence<br />
            <span>at citation speed</span>
          </h1>
          <p className="land-sub">
            Upload multiple PDFs, ask cross-document questions, discover research gaps,
            and get answers with clickable citations that jump directly to the source page.
          </p>
          <div className="land-btns">
            <SignedOut>
              <SignInButton mode="modal" redirectUrl="/workspace">
                <button className="btn-primary">Get started free →</button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <button className="btn-primary" onClick={() => router.push('/workspace')}>
                Open dashboard →
              </button>
            </SignedIn>
          </div>
        </section>

        {/* Feature grid */}
        <div className="land-features">
          {[
            { icon: '📄', title: 'Multi-PDF workspace', desc: 'Upload 1–10 PDFs per workspace. Every answer is grounded across all of them.' },
            { icon: '🔗', title: 'Clickable citations', desc: 'Every AI response includes source chips. Click to jump to the exact page in the PDF.' },
            { icon: '🔍', title: 'Research gap analysis', desc: 'Automatically surfaces methodological, theoretical and empirical gaps across your corpus.' },
            { icon: '🌐', title: 'Internet-augmented mode', desc: 'Switch to web mode: extracts keywords, searches CrossRef & Semantic Scholar, synthesises findings.' },
          ].map(f => (
            <div key={f.title} className="land-feat">
              <div className="land-feat-icon">{f.icon}</div>
              <div className="land-feat-title">{f.title}</div>
              <div className="land-feat-desc">{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="land-footer">© {new Date().getFullYear()} Radium · Built for academic research</div>
      </div>
    </>
  );
}
