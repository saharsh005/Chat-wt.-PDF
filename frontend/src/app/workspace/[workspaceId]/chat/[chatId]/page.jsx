'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import {
  Send, Plus, FileText, MessageSquare, X, ChevronLeft,
  Sparkles, Search, Share2, Check, Sun, Moon, Globe, BookOpen,
  Loader2, BarChart2, ExternalLink, Upload,
} from 'lucide-react';
import PdfViewer from '../../../../../component/PdfViewer';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

// ── Gap type colours ────────────────────────────────────────────────────────
const GAP_COLORS = {
  'METHODOLOGICAL GAP': '#6495ed',
  'THEORETICAL GAP':    '#a78bfa',
  'EMPIRICAL GAP':      '#4ade80',
  'APPLICATION GAP':    '#f59e0b',
  'POPULATION GAP':     '#f472b6',
};

export default function WorkspaceChatPage() {
  const { isLoaded, user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const workspaceId = params?.workspaceId;
  const chatId      = params?.chatId;

  // ── Layout state ──────────────────────────────────────────────────────────
  const [leftPct, setLeftPct]     = useState(48);
  const [dragging, setDragging]   = useState(false);
  const [closedPdfIds, setClosedPdfIds] = useState(new Set());
  const [theme, setTheme]         = useState('dark');

  // ── Data state ────────────────────────────────────────────────────────────
  const [workspace, setWorkspace]       = useState(null);
  const [messages, setMessages]         = useState([]);
  const [workspaceChats, setWsChats]    = useState([]);
  const [workspacePdfs, setWsPdfs]      = useState([]);
  const [activePdf, setActivePdf]       = useState(null);
  const [activePage, setActivePage]     = useState(1);
  const [researchGaps, setGaps]         = useState([]);
  const [internetPapers, setIntPapers]  = useState([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [input, setInput]               = useState('');
  const [sending, setSending]           = useState(false);
  const [loadingMsgs, setLoadingMsgs]   = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [loadingGaps, setLoadingGaps]   = useState(false);
  const [showGaps, setShowGaps]         = useState(false);
  const [viewingAbstract, setViewingAbstract]   = useState(null);
  const [abstractText, setAbstractText] = useState('');
  const [genAbstract, setGenAbstract]   = useState(false);
  const [chatMode, setChatMode]         = useState('pdf'); // 'pdf' | 'internet'
  const [copied, setCopied]             = useState(false);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const t = {
    bg:       theme === 'dark' ? '#080808' : '#ffffff',
    bgAlt:    theme === 'dark' ? '#0d0d0d' : '#f8f8f8',
    bgSub:    theme === 'dark' ? '#111'    : '#f0f0f0',
    border:   theme === 'dark' ? '#141414' : '#e5e5e5',
    borderAlt:theme === 'dark' ? '#111'    : '#ebebeb',
    text:     theme === 'dark' ? '#e2e2e2' : '#111',
    textSub:  theme === 'dark' ? '#888'    : '#555',
    textMuted:theme === 'dark' ? '#444'    : '#aaa',
    navBg:    theme === 'dark' ? '#080808' : '#fff',
    accent:   '#6495ed',
  };

  // ── Resize handler ────────────────────────────────────────────────────────
  const onResizerDown = useCallback(e => { e.preventDefault(); setDragging(true); }, []);
  useEffect(() => {
    if (!dragging) return;
    const move = e => {
      const pct = (e.clientX / window.innerWidth) * 100;
      if (pct > 18 && pct < 82) setLeftPct(pct);
    };
    const up = () => setDragging(false);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  }, [dragging]);

  // ── Load workspace data ───────────────────────────────────────────────────
  const loadWsData = useCallback(async () => {
    if (!workspaceId) return;
    const token = await getToken();
    const hdr = { Authorization: `Bearer ${token}` };
    const [wsRes, pdfRes, chatRes] = await Promise.all([
      fetch(`${API}/workspace/${workspaceId}`, { headers: hdr }),
      fetch(`${API}/workspace/${workspaceId}/pdfs`, { headers: hdr }),
      fetch(`${API}/workspace/${workspaceId}/chats`, { headers: hdr }),
    ]);
    const [ws, pdfs, chats] = await Promise.all([wsRes.json(), pdfRes.json(), chatRes.json()]);
    setWorkspace(ws);
    setWsPdfs(Array.isArray(pdfs) ? pdfs : []);
    setWsChats(Array.isArray(chats) ? chats : []);
    if (!activePdf && Array.isArray(pdfs) && pdfs.length > 0) setActivePdf(pdfs[0]);
  }, [workspaceId, getToken]);

  // ── Load chat messages ────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!chatId) return;
    setLoadingMsgs(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/chat/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } finally {
      setLoadingMsgs(false);
    }
  }, [chatId, getToken]);

  useEffect(() => { loadWsData(); }, [loadWsData]);
  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text, mode: chatMode }]);
    setSending(true);

    try {
      const token = await getToken();
      const endpoint = chatMode === 'internet' ? `${API}/chat/internet` : `${API}/chat`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: text, chatId, workspaceId }),
      });
      const data = await res.json();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer || 'No response generated.',
        sources: data.sources || [],
        papers: data.papers || [],
        gaps: data.gaps || [],
        mode: chatMode,
      }]);

      if (data.gaps?.length) setGaps(prev => [...data.gaps, ...prev.filter(g => !data.gaps.find(ng => ng.title === g.title))]);
      if (data.papers?.length) setIntPapers(data.papers);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Request failed. Please try again.', sources: [] }]);
    } finally {
      setSending(false);
    }
  };

  // ── Upload PDFs ───────────────────────────────────────────────────────────
  const uploadPDFs = async files => {
    if (!files?.length) return;
    setUploading(true);
    const token = await getToken();
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('pdf', file); fd.append('workspaceId', workspaceId);
      await fetch(`${API}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    }
    await loadWsData();
    setUploading(false);
  };

  // ── Research gaps ─────────────────────────────────────────────────────────
  const loadGaps = async () => {
    setLoadingGaps(true);
    const token = await getToken();
    const res = await fetch(`${API}/workspace/${workspaceId}/research-gaps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setGaps(Array.isArray(data) ? data : []);
    setLoadingGaps(false);
  };

  const generateAbstract = async gap => {
    setViewingAbstract(gap);
    setGenAbstract(true);
    setAbstractText('');
    const token = await getToken();
    const res = await fetch(`${API}/workspace/${workspaceId}/generate-abstract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ gapTitle: gap.title, gapDescription: gap.description }),
    });
    const data = await res.json();
    setAbstractText(data.abstract || 'Failed to generate abstract.');
    setGenAbstract(false);
  };

  // ── New chat ──────────────────────────────────────────────────────────────
  const newChat = async () => {
    const token = await getToken();
    const res = await fetch(`${API}/chat/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ workspaceId }),
    });
    const data = await res.json();
    await loadWsData();
    router.push(`/workspace/${workspaceId}/chat/${data.id}`);
  };

  // ── Citation click → jump PDF page ───────────────────────────────────────
  const jumpToSource = src => {
    const pdf = workspacePdfs.find(p => p.pdf_id === src.pdfId);
    if (pdf) { setActivePdf(pdf); setActivePage(src.page || 1); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isLoaded) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#080808', color: '#444', fontFamily: 'monospace', fontSize: 13 }}>
      Loading…
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: t.bg, color: t.text, fontFamily: "'Inter', -apple-system, sans-serif", overflow: 'hidden' }}>

      {/* ── TOP NAV ── */}
      <div style={{ display: 'flex', alignItems: 'center', height: 46, borderBottom: `1px solid ${t.border}`, padding: '0 14px', gap: 10, flexShrink: 0, background: t.navBg }}>
        <button style={navBtn(t)} onClick={() => router.push('/workspace')}>
          <ChevronLeft size={13} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#6495ed,#8b67d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>R</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1 }}>Radium</div>
            <div style={{ fontSize: 9, color: t.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Research Assistant</div>
          </div>
        </div>

        <div style={{ fontSize: 13, color: t.textMuted, marginLeft: 4 }}>/</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: t.textSub, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {workspace?.title || '…'}
        </div>

        <div style={{ flex: 1 }} />

        {/* Chat mode toggle */}
        <div style={{ display: 'flex', background: t.bgSub, border: `1px solid ${t.border}`, borderRadius: 8, padding: 2, gap: 2 }}>
          {[
            { key: 'pdf', icon: <BookOpen size={11} />, label: 'PDF RAG' },
            { key: 'internet', icon: <Globe size={11} />, label: 'Web' },
          ].map(m => (
            <button key={m.key} onClick={() => setChatMode(m.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 500, cursor: 'pointer', transition: 'all .15s',
                background: chatMode === m.key ? (theme === 'dark' ? '#1a1a1a' : '#fff') : 'transparent',
                color: chatMode === m.key ? t.accent : t.textMuted,
                boxShadow: chatMode === m.key ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
              }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <button style={navBtn(t)} onClick={() => { setShowGaps(v => { if (!v && researchGaps.length === 0) loadGaps(); return !v; })} } title="Research gaps">
          <Sparkles size={13} style={{ color: showGaps ? '#a78bfa' : undefined }} />
        </button>
        <button style={navBtn(t)} onClick={copyLink} title="Copy link">
          {copied ? <Check size={13} style={{ color: '#4ade80' }} /> : <Share2 size={13} />}
        </button>
        <button style={navBtn(t)} onClick={() => setTheme(v => v === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>
        {user?.imageUrl
          ? <img src={user.imageUrl} style={{ width: 26, height: 26, borderRadius: '50%', border: `1px solid ${t.border}`, objectFit: 'cover' }} alt="avatar" />
          : <div style={{ width: 26, height: 26, borderRadius: '50%', background: t.bgSub, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>👤</div>}
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', cursor: dragging ? 'col-resize' : 'auto', userSelect: dragging ? 'none' : 'auto' }}>

        {/* ── LEFT: PDF panel ── */}
        <div style={{ width: `${leftPct}%`, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${t.border}`, overflow: 'hidden' }}>

          {/* PDF tabs */}
          <div style={{ display: 'flex', alignItems: 'center', height: 38, borderBottom: `1px solid ${t.border}`, background: t.bgAlt, overflowX: 'auto', flexShrink: 0 }}>
            {workspacePdfs.filter(p => !closedPdfIds.has(p.pdf_id)).map(pdf => {
              const active = activePdf?.pdf_id === pdf.pdf_id;
              return (
                <div key={pdf.pdf_id} onClick={() => { setActivePdf(pdf); setActivePage(1); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: '100%', borderRight: `1px solid ${t.border}`, cursor: 'pointer', flexShrink: 0, maxWidth: 170, transition: 'all .15s',
                    background: active ? t.bg : 'transparent',
                    borderBottom: active ? `2px solid ${t.accent}` : '2px solid transparent',
                    color: active ? t.text : t.textMuted, fontSize: 11, fontWeight: active ? 500 : 400,
                  }}>
                  <FileText size={11} style={{ color: active ? t.accent : t.textMuted, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdf.filename}</span>
                  <X size={9} style={{ marginLeft: 3, flexShrink: 0, color: t.textMuted, cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); setClosedPdfIds(s => new Set([...s, pdf.pdf_id])); if (activePdf?.pdf_id === pdf.pdf_id) setActivePdf(null); }}
                    onMouseEnter={e => e.target.style.color = '#e85d5d'}
                    onMouseLeave={e => e.target.style.color = t.textMuted} />
                </div>
              );
            })}
            {/* Upload tab */}
            <label style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: '100%', borderRight: `1px solid ${t.border}`, cursor: 'pointer', color: t.textMuted, flexShrink: 0 }} title="Upload PDF">
              {uploading ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Plus size={12} />}
              <input type="file" multiple accept=".pdf" hidden onChange={e => uploadPDFs(e.target.files)} />
            </label>
          </div>

          {/* PDF viewer */}
          <div style={{ flex: 1, overflow: 'hidden', background: '#0a0a0a', display: 'flex', alignItems: activePdf ? 'flex-start' : 'center', justifyContent: 'center' }}>
            {activePdf ? (
              <PdfViewer pdfId={activePdf.pdf_id} page={activePage} />
            ) : (
              <div style={{ textAlign: 'center', color: t.textMuted }}>
                <FileText size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
                <div style={{ fontSize: 13 }}>No PDF selected</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: 0.5 }}>Open a tab or upload a PDF</div>
              </div>
            )}
          </div>
        </div>

        {/* ── RESIZER ── */}
        <div onMouseDown={onResizerDown} style={{ width: 4, flexShrink: 0, cursor: 'col-resize', background: dragging ? t.accent : 'transparent', transition: 'background .2s', zIndex: 5 }} />

        {/* ── RIGHT: Chat + optional gaps panel ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

          {/* Chat tabs */}
          <div style={{ display: 'flex', alignItems: 'center', height: 38, borderBottom: `1px solid ${t.border}`, background: t.bgAlt, overflowX: 'auto', flexShrink: 0 }}>
            {workspaceChats.map(chat => {
              const active = chatId === String(chat.id);
              return (
                <div key={chat.id} onClick={() => router.push(`/workspace/${workspaceId}/chat/${chat.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: '100%', borderRight: `1px solid ${t.border}`, cursor: 'pointer', flexShrink: 0, maxWidth: 170, transition: 'all .15s',
                    background: active ? t.bg : 'transparent',
                    borderBottom: active ? `2px solid ${t.accent}` : '2px solid transparent',
                    color: active ? t.text : t.textMuted, fontSize: 11, fontWeight: active ? 500 : 400,
                  }}>
                  <MessageSquare size={11} style={{ color: active ? t.accent : t.textMuted, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.title || 'Chat'}</span>
                </div>
              );
            })}
            <button onClick={newChat} style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: '100%', background: 'none', border: 'none', borderRight: `1px solid ${t.border}`, cursor: 'pointer', color: t.textMuted, flexShrink: 0 }}>
              <Plus size={12} />
            </button>
          </div>

          {/* Mode badge */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', borderBottom: `1px solid ${t.borderAlt}`, background: t.bgAlt, gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: chatMode === 'pdf' ? '#6495ed' : '#f59e0b', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {chatMode === 'pdf' ? <><BookOpen size={10} /> PDF RAG mode</> : <><Globe size={10} /> Internet mode</>}
            </div>
            {chatMode === 'pdf' && activePdf && (
              <div style={{ fontSize: 10, color: '#4ade80', background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 5, padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#4ade80' }} /> {activePdf.filename}
              </div>
            )}
            {chatMode === 'internet' && (
              <div style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 5, padding: '2px 7px' }}>
                CrossRef + Semantic Scholar
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 0' }}>
            {loadingMsgs && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <Loader2 size={18} style={{ color: t.textMuted, animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 20 }} className="fade-up">
                {m.role === 'assistant' ? (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#6495ed,#8b67d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 1 }}>R</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: t.accent, fontWeight: 600, letterSpacing: '0.06em' }}>RADIUM AI</span>
                        {m.mode === 'internet' && <span style={{ fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 4, padding: '1px 5px' }}>WEB</span>}
                      </div>
                      <div className="md" style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>

                      {/* PDF source chips */}
                      {m.sources?.length > 0 && (
                        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {m.sources.map((src, si) => (
                            <button key={si} onClick={() => jumpToSource(src)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: t.bgSub, border: `1px solid ${t.border}`, borderRadius: 6, padding: '3px 8px', fontSize: 10, color: t.textMuted, cursor: 'pointer', transition: 'all .2s' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.text; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
                              title={src.preview}>
                              <FileText size={9} style={{ color: t.accent }} />
                              {src.filename}
                              <span style={{ opacity: 0.5 }}>p.{src.page}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Internet paper chips */}
                      {m.papers?.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Web sources</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {m.papers.slice(0, 4).map((p, pi) => (
                              <div key={pi} style={{ background: t.bgSub, border: `1px solid ${t.border}`, borderRadius: 7, padding: '7px 10px' }}>
                                <div style={{ fontSize: 11, fontWeight: 500, color: t.text, marginBottom: 2 }}>{p.title}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: t.textMuted }}>
                                  <span>{p.authors?.split(',')[0]}{p.year ? ` · ${p.year}` : ''}</span>
                                  <span style={{ background: '#111', border: `1px solid ${t.border}`, borderRadius: 4, padding: '1px 5px' }}>{p.source}</span>
                                  {p.url && (
                                    <a href={p.url} target="_blank" rel="noreferrer"
                                      style={{ display: 'flex', alignItems: 'center', gap: 3, color: t.accent, textDecoration: 'none' }}>
                                      <ExternalLink size={9} /> View
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ background: t.bgAlt, border: `1px solid ${t.borderAlt}`, borderRadius: 10, padding: '9px 13px', fontSize: 13, color: t.text, maxWidth: '78%', lineHeight: 1.6 }}>
                      {m.content}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {sending && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#6495ed,#8b67d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>R</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', paddingTop: 6 }}>
                  {[0,1,2].map(n => (
                    <div key={n} style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${n*0.2}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: 12, flexShrink: 0 }}>
            <div style={{ background: t.bgAlt, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={chatMode === 'internet' ? 'Search across the web for research…' : (activePdf ? `Ask about ${activePdf.filename}…` : 'Ask Radium…')}
                rows={2}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', padding: '10px 14px 6px', fontSize: 13, color: t.text, resize: 'none', fontFamily: 'inherit', lineHeight: 1.55 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', padding: '4px 10px 10px', gap: 8 }}>
                <span style={{ fontSize: 10, color: t.textMuted }}>Enter to send · Shift+Enter for newline</span>
                <div style={{ flex: 1 }} />
                <button onClick={sendMessage} disabled={sending || !input.trim()}
                  style={{ width: 30, height: 30, borderRadius: 8, background: input.trim() ? 'linear-gradient(135deg,#6495ed,#8b67d4)' : t.bgSub, border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>
                  <Send size={12} style={{ color: input.trim() ? '#fff' : t.textMuted }} />
                </button>
              </div>
            </div>
          </div>

          {/* ── RESEARCH GAPS SIDE PANEL ── */}
          {showGaps && (
            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 340, background: t.bg, borderLeft: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', zIndex: 20, boxShadow: '-8px 0 32px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: `1px solid ${t.border}`, background: t.bgAlt, flexShrink: 0 }}>
                {viewingAbstract ? (
                  <button onClick={() => { setViewingAbstract(null); setAbstractText(''); }} style={{ ...navBtn(t), marginRight: 8 }}>
                    <ChevronLeft size={14} />
                  </button>
                ) : <Sparkles size={13} style={{ color: '#a78bfa', marginRight: 8 }} />}
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                  {viewingAbstract ? 'Generated Abstract' : 'Research Gaps'}
                </span>
                <button onClick={loadGaps} disabled={loadingGaps} title="Refresh" style={{ ...navBtn(t), marginRight: 6 }}>
                  {loadingGaps ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <BarChart2 size={12} />}
                </button>
                <button onClick={() => { setShowGaps(false); setViewingAbstract(null); }} style={navBtn(t)}>
                  <X size={13} />
                </button>
              </div>

              {!viewingAbstract ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {loadingGaps && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
                      <Loader2 size={24} style={{ color: t.accent, animation: 'spin 0.8s linear infinite' }} />
                      <div style={{ fontSize: 11, color: t.textMuted }}>Analysing documents…</div>
                    </div>
                  )}
                  {!loadingGaps && researchGaps.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: t.textMuted, fontSize: 12 }}>
                      No gaps yet. Click refresh to analyse your workspace documents.
                    </div>
                  )}
                  {researchGaps.map((gap, i) => {
                    const col = GAP_COLORS[gap.type] || t.accent;
                    return (
                      <div key={gap.id || i} style={{ background: t.bgAlt, border: `1px solid ${t.borderAlt}`, borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: col, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>{gap.type}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 5, lineHeight: 1.4 }}>{gap.title}</div>
                        {gap.description && <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.55 }}>{gap.description}</div>}
                        {gap.citations?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                            {gap.citations.map((c, ci) => (
                              <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 3, background: t.bgSub, border: `1px solid ${t.border}`, borderRadius: 4, padding: '2px 6px', fontSize: 10, color: t.textMuted }}>
                                <FileText size={9} />{c.filename}
                              </div>
                            ))}
                          </div>
                        )}
                        <button onClick={() => generateAbstract(gap)}
                          style={{ marginTop: 10, width: '100%', background: 'rgba(100,149,237,0.07)', border: `1px solid rgba(100,149,237,0.15)`, borderRadius: 7, padding: '7px 10px', fontSize: 11, color: t.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                          <Sparkles size={10} /> Generate abstract
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.accent }}>{viewingAbstract.title}</div>
                  {genAbstract ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 }}>
                      <Loader2 size={22} style={{ color: t.accent, animation: 'spin 0.8s linear infinite' }} />
                      <div style={{ fontSize: 11, color: t.textMuted }}>Synthesising abstract…</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: t.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{abstractText}</div>
                      <div style={{ marginTop: 'auto', background: 'rgba(100,149,237,0.06)', border: '1px solid rgba(100,149,237,0.12)', borderRadius: 8, padding: 10, fontSize: 11, color: t.accent, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <Sparkles size={11} style={{ flexShrink: 0, marginTop: 1 }} />
                        Based on {workspacePdfs.length} document{workspacePdfs.length !== 1 ? 's' : ''} in this workspace.
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div style={{ height: 26, borderTop: `1px solid ${t.borderAlt}`, background: t.bgAlt, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80' }} />
          <span style={{ fontSize: 10, color: t.textMuted }}>{workspacePdfs.length} doc{workspacePdfs.length !== 1 ? 's' : ''} indexed</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: t.textMuted, letterSpacing: '0.05em' }}>RADIUM · {chatMode === 'internet' ? 'WEB MODE' : 'RAG MODE'}</span>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.85)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp .22s ease both; }
        textarea::placeholder { color: ${t.textMuted}; }
      `}</style>
    </div>
  );
}

function navBtn(t) {
  return {
    background: 'none', border: `1px solid ${t.border}`, borderRadius: 7,
    color: t.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', width: 28, height: 28, transition: 'all .15s',
    padding: 0,
  };
}
