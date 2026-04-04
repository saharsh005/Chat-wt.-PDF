'use client';

import { useEffect, useState } from 'react';
import { useAuth, UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Plus, Folder, Trash2, ArrowRight, Loader2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function WorkspaceList() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/workspace`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setWorkspaces(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/workspace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await res.json();
      router.push(`/workspace/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function deleteWs(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this workspace and all its data?')) return;
    const token = await getToken();
    await fetch(`${API}/workspace/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setWorkspaces(ws => ws.filter(w => w.id !== id));
  }

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
          --accent-dim: rgba(201,169,110,0.10);
          --accent-border: rgba(201,169,110,0.22);
          --danger: #c0614a;
          --danger-dim: rgba(192,97,74,0.12);
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .ws {
          min-height: 100vh;
          background: var(--bg);
          color: var(--text-primary);
          font-family: 'DM Sans', sans-serif;
          position: relative;
        }

        /* Noise texture */
        .ws::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
          opacity: 0.5;
        }

        /* Nav */
        .ws-nav {
          position: relative;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 48px;
          border-bottom: 1px solid var(--border);
        }

        .ws-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          text-decoration: none;
        }

        .ws-logo-icon svg { width: 28px; height: 28px; }

        .ws-logo-name {
          font-family: 'DM Serif Display', serif;
          font-size: 18px;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        /* Body */
        .ws-body {
          position: relative;
          z-index: 10;
          max-width: 960px;
          margin: 0 auto;
          padding: 56px 48px 80px;
          animation: fadeIn 0.5s ease both;
        }

        /* Page header */
        .ws-page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 40px;
          padding-bottom: 28px;
          border-bottom: 1px solid var(--border);
        }

        .ws-page-title {
          font-family: 'DM Serif Display', serif;
          font-size: 34px;
          font-weight: 400;
          letter-spacing: -0.025em;
          line-height: 1.1;
          color: var(--text-primary);
        }

        .ws-page-title em {
          font-style: italic;
          color: var(--accent);
        }

        .ws-page-sub {
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 6px;
          font-weight: 300;
        }

        /* New workspace button */
        .ws-new-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          background: var(--text-primary);
          border: none;
          border-radius: 9px;
          padding: 10px 18px;
          color: var(--bg);
          font-size: 13px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all 0.18s ease;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .ws-new-btn:hover {
          background: #fff;
          box-shadow: 0 4px 20px rgba(240,237,232,0.12);
          transform: translateY(-1px);
        }

        /* Create form */
        .ws-form {
          background: var(--bg-2);
          border: 1px solid var(--accent-border);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 32px;
          display: flex;
          gap: 10px;
          animation: slideDown 0.22s ease both;
        }

        .ws-input {
          flex: 1;
          background: var(--bg-3);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 14px;
          color: var(--text-primary);
          font-size: 13.5px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.18s;
        }

        .ws-input:focus { border-color: var(--accent); }
        .ws-input::placeholder { color: var(--text-muted); }

        .ws-create-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--accent);
          border: none;
          border-radius: 8px;
          padding: 10px 18px;
          color: #0f0f0f;
          font-size: 13px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.18s;
        }

        .ws-create-btn:hover { background: #d4b478; }
        .ws-create-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        /* Grid */
        .ws-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          background: transparent;
          border: none;
        }

        @media (max-width: 860px) {
          .ws-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 560px) {
          .ws-grid { grid-template-columns: 1fr; }
        }

        /* Card */
        .ws-card {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease;
          display: flex;
          flex-direction: column;
          gap: 0;
          position: relative;
        }

        .ws-card:hover { background: var(--bg-3); border-color: var(--border-hover); }

        .ws-card:hover .ws-card-open {
          color: var(--accent);
        }

        .ws-card:hover .ws-card-arrow {
          transform: translateX(3px);
        }

        .ws-card-num {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 14px;
        }

        .ws-card-title {
          font-family: 'DM Serif Display', serif;
          font-size: 16px;
          font-weight: 400;
          letter-spacing: -0.01em;
          color: var(--text-primary);
          line-height: 1.35;
          margin-bottom: 6px;
          flex: 1;
        }

        .ws-card-date {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 300;
          margin-bottom: 18px;
        }

        .ws-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 14px;
          border-top: 1px solid var(--border);
        }

        .ws-card-open {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 500;
          transition: color 0.18s;
        }

        .ws-card-arrow {
          transition: transform 0.18s ease;
        }

        .ws-del-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          padding: 5px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: all 0.18s;
          opacity: 0;
        }

        .ws-card:hover .ws-del-btn { opacity: 1; }

        .ws-del-btn:hover {
          color: var(--danger);
          background: var(--danger-dim);
        }

        /* Loading */
        .ws-loading {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 80px 0;
        }

        .ws-spinner {
          animation: spin 0.9s linear infinite;
          color: var(--text-muted);
        }

        /* Empty state */
        .ws-empty {
          text-align: center;
          padding: 80px 0;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--bg-2);
        }

        .ws-empty-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: var(--bg-3);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        .ws-empty-title {
          font-family: 'DM Serif Display', serif;
          font-size: 18px;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .ws-empty-sub {
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 300;
        }

        @media (max-width: 640px) {
          .ws-nav { padding: 16px 20px; }
          .ws-body { padding: 40px 20px 60px; }
          .ws-page-header { flex-direction: column; align-items: flex-start; gap: 16px; }
        }
      `}</style>

      <div className="ws">
        {/* Nav */}
        <nav className="ws-nav">
          <div className="ws-logo" onClick={() => router.push('/')}>
            <div className="ws-logo-icon">
              <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="4" width="14" height="20" rx="2" stroke="#c9a96e" strokeWidth="1.4" fill="none"/>
                <rect x="9" y="4" width="14" height="20" rx="2" stroke="rgba(201,169,110,0.35)" strokeWidth="1.4" fill="rgba(201,169,110,0.04)"/>
                <line x1="12" y1="10" x2="19" y2="10" stroke="#c9a96e" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
                <line x1="12" y1="14" x2="19" y2="14" stroke="#c9a96e" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
                <line x1="12" y1="18" x2="16" y2="18" stroke="#c9a96e" strokeWidth="1.2" strokeLinecap="round" opacity="0.35"/>
              </svg>
            </div>
            <span className="ws-logo-name">Radium</span>
          </div>
          <UserButton afterSignOutUrl="/" />
        </nav>

        <div className="ws-body">
          {/* Header */}
          <div className="ws-page-header">
            <div>
              <div className="ws-page-title">
                Your <em>workspaces</em>
              </div>
              <div className="ws-page-sub">
                {loading ? 'Loading…' : `${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''}`}
              </div>
            </div>
            <button className="ws-new-btn" onClick={() => setShowForm(v => !v)}>
              <Plus size={14} />
              New workspace
            </button>
          </div>

          {/* Create form */}
          {showForm && (
            <div className="ws-form">
              <input
                className="ws-input"
                placeholder="e.g. 'ML Fairness Review' or 'Climate Policy Papers'"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && create()}
                autoFocus
              />
              <button className="ws-create-btn" onClick={create} disabled={creating || !title.trim()}>
                {creating
                  ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                  : <><Plus size={13} /> Create</>
                }
              </button>
            </div>
          )}

          {/* States */}
          {loading ? (
            <div className="ws-loading">
              <Loader2 size={20} className="ws-spinner" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="ws-empty">
              <div className="ws-empty-icon">
                <Folder size={20} color="var(--text-muted)" />
              </div>
              <div className="ws-empty-title">No workspaces yet</div>
              <div className="ws-empty-sub">Create one above to start uploading papers</div>
            </div>
          ) : (
            <div className="ws-grid">
              {workspaces.map((ws, i) => (
                <div
                  key={ws.id}
                  className="ws-card"
                  onClick={() => router.push(`/workspace/${ws.id}`)}
                >
                  <div className="ws-card-num">{String(i + 1).padStart(2, '0')}</div>
                  <div className="ws-card-title">{ws.title}</div>
                  <div className="ws-card-date">
                    Created {new Date(ws.created_at).toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </div>
                  <div className="ws-card-footer">
                    <div className="ws-card-open">
                      Open workspace
                      <ArrowRight size={12} className="ws-card-arrow" />
                    </div>
                    <button
                      className="ws-del-btn"
                      onClick={e => deleteWs(e, ws.id)}
                      title="Delete workspace"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}