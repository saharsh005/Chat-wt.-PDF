'use client';

import { useEffect, useState } from 'react';
import { useAuth, UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Plus, Folder, Trash2, ArrowRight, FileText, MessageSquare, Loader2 } from 'lucide-react';

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
        .ws { min-height:100vh; background:#080808; color:#e2e2e2; font-family:'Inter',-apple-system,sans-serif; }
        .ws-nav { display:flex; align-items:center; justify-content:space-between; padding:16px 32px; border-bottom:1px solid #111; }
        .ws-logo { display:flex; align-items:center; gap:9px; cursor:pointer; }
        .ws-logo-mark { width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#6495ed,#8b67d4);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff; }
        .ws-logo-label { font-size:14px;font-weight:700;letter-spacing:-0.01em; }
        .ws-body { max-width:900px; margin:0 auto; padding:48px 24px; }
        .ws-header { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:32px; }
        .ws-title { font-size:26px; font-weight:700; letter-spacing:-0.02em; }
        .ws-sub { font-size:13px; color:#555; margin-top:4px; }
        .ws-new-btn { display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,#6495ed,#8b67d4);border:none;border-radius:9px;padding:10px 18px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s; }
        .ws-new-btn:hover { transform:translateY(-1px);box-shadow:0 8px 24px rgba(100,149,237,0.25); }
        .ws-form { background:#0d0d0d;border:1px solid #1a1a1a;border-radius:14px;padding:20px;margin-bottom:28px;display:flex;gap:10px; }
        .ws-input { flex:1;background:#111;border:1px solid #1e1e1e;border-radius:9px;padding:10px 14px;color:#e2e2e2;font-size:14px;outline:none;transition:border-color .2s; }
        .ws-input:focus { border-color:#6495ed; }
        .ws-input::placeholder { color:#333; }
        .ws-create-btn { display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#6495ed,#8b67d4);border:none;border-radius:9px;padding:10px 18px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:opacity .2s; }
        .ws-create-btn:disabled { opacity:.5;cursor:not-allowed; }
        .ws-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:12px; }
        .ws-card { background:#0d0d0d;border:1px solid #141414;border-radius:14px;padding:20px;cursor:pointer;transition:all .2s;position:relative;group; }
        .ws-card:hover { border-color:#252525;transform:translateY(-1px);box-shadow:0 8px 32px rgba(0,0,0,0.4); }
        .ws-card-icon { width:38px;height:38px;border-radius:10px;background:rgba(100,149,237,0.08);border:1px solid rgba(100,149,237,0.12);display:flex;align-items:center;justify-content:center;margin-bottom:14px; }
        .ws-card-title { font-size:15px;font-weight:600;letter-spacing:-0.01em;margin-bottom:6px; }
        .ws-card-date { font-size:11px;color:#444; }
        .ws-card-footer { display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding-top:14px;border-top:1px solid #111; }
        .ws-card-open { display:flex;align-items:center;gap:5px;font-size:12px;color:#6495ed;font-weight:500; }
        .ws-del-btn { background:none;border:none;cursor:pointer;color:#333;padding:4px;border-radius:5px;display:flex;transition:color .2s; }
        .ws-del-btn:hover { color:#e85d5d; }
        .ws-empty { text-align:center;padding:80px 0; }
        .ws-empty-icon { width:56px;height:56px;border-radius:16px;background:#0d0d0d;border:1px solid #141414;display:flex;align-items:center;justify-content:center;margin:0 auto 16px; }
        .ws-empty-text { font-size:14px;color:#555; }
      `}</style>

      <div className="ws">
        <nav className="ws-nav">
          <div className="ws-logo" onClick={() => router.push('/')}>
            <div className="ws-logo-mark">R</div>
            <span className="ws-logo-label">Radium</span>
          </div>
          <UserButton afterSignOutUrl="/" />
        </nav>

        <div className="ws-body">
          <div className="ws-header">
            <div>
              <div className="ws-title">Workspaces</div>
              <div className="ws-sub">{workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}</div>
            </div>
            <button className="ws-new-btn" onClick={() => setShowForm(v => !v)}>
              <Plus size={14} /> New workspace
            </button>
          </div>

          {showForm && (
            <div className="ws-form">
              <input
                className="ws-input"
                placeholder="Workspace title, e.g. 'ML & Fairness Review'"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && create()}
                autoFocus
              />
              <button className="ws-create-btn" onClick={create} disabled={creating || !title.trim()}>
                {creating ? <Loader2 size={13} className="spin" /> : <><Plus size={13} /> Create</>}
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <Loader2 size={22} style={{ color: '#333', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="ws-empty">
              <div className="ws-empty-icon"><Folder size={22} color="#333" /></div>
              <div className="ws-empty-text">No workspaces yet — create one to get started</div>
            </div>
          ) : (
            <div className="ws-grid">
              {workspaces.map(ws => (
                <div key={ws.id} className="ws-card" onClick={() => router.push(`/workspace/${ws.id}`)}>
                  <div className="ws-card-icon"><Folder size={16} color="#6495ed" /></div>
                  <div className="ws-card-title">{ws.title}</div>
                  <div className="ws-card-date">
                    {new Date(ws.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="ws-card-footer">
                    <div className="ws-card-open">
                      Open workspace <ArrowRight size={12} />
                    </div>
                    <button className="ws-del-btn" onClick={e => deleteWs(e, ws.id)} title="Delete">
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
