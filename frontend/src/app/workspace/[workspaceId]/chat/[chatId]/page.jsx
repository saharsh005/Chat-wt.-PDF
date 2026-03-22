'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageSquare, Plus, PanelLeftClose, FileText, Search, Share2, Download, Settings, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, MoreHorizontal, Paperclip, Sparkles, X, Sun, Moon, Check } from 'lucide-react';
import { useRouter, useParams } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import PdfViewer from "../../../../../component/PdfViewer";

export default function WorkspaceChatPage() {
  const { isLoaded } = useUser();
  const { getToken } = useAuth();

  const router = useRouter();
  const params = useParams();

  const workspaceId = params?.workspaceId;
  const chatId = params?.chatId;

  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

  /* ───────── STATE ───────── */

  const [chatData, setChatData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [workspaceChats, setWorkspaceChats] = useState([]);
  const [workspacePdfs, setWorkspacePdfs] = useState([]);

  const [input, setInput] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);

  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);

  const [activePdfForViewer, setActivePdfForViewer] = useState(null);
  const [researchGaps, setResearchGaps] = useState([]);
  const [loadingGaps, setLoadingGaps] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showResearchGaps, setShowResearchGaps] = useState(false);
  const [viewingAbstract, setViewingAbstract] = useState(false);
  const [abstractContent, setAbstractContent] = useState('');
  const [generatingAbstract, setGeneratingAbstract] = useState(false);
  
  const [theme, setTheme] = useState('dark');
  const [showShareSuccess, setShowShareSuccess] = useState(false);
  const { user } = useUser();

  const [leftWidth, setLeftWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [closedTabIds, setClosedTabIds] = useState(new Set());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && workspaceId) {
      const savedWidth = localStorage.getItem(`radium_splitWidth_${workspaceId}`);
      if (savedWidth) setLeftWidth(Number(savedWidth));

      const savedClosedTabs = localStorage.getItem(`radium_closedTabs_${workspaceId}`);
      if (savedClosedTabs) {
        try {
          setClosedTabIds(new Set(JSON.parse(savedClosedTabs)));
        } catch (e) {}
      }
      setIsReady(true);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (isReady && typeof window !== 'undefined' && workspaceId) {
      localStorage.setItem(`radium_splitWidth_${workspaceId}`, leftWidth.toString());
      localStorage.setItem(`radium_closedTabs_${workspaceId}`, JSON.stringify([...closedTabIds]));
    }
  }, [leftWidth, closedTabIds, isReady, workspaceId]);

  const messagesEndRef = useRef(null);

  /* ───────── RESIZE HANDLERS ───────── */

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  /* ───────── LOAD WORKSPACE DATA ───────── */

  const loadWorkspaceChats = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/workspace/${workspaceId}/chats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setWorkspaceChats(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Chats load failed:", err);
      setWorkspaceChats([]);
    }
  }, [getToken, workspaceId, API_BASE]);

  const loadWorkspacePdfs = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/workspace/${workspaceId}/pdfs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setWorkspacePdfs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("PDF load failed:", err);
      setWorkspacePdfs([]);
    }
  }, [getToken, workspaceId, API_BASE]);

  useEffect(() => {
    if (workspaceId) {
      loadWorkspaceChats();
      loadWorkspacePdfs();
    }
  }, [workspaceId, loadWorkspaceChats, loadWorkspacePdfs]);

  // Auto-refresh gaps when PDFs change
  useEffect(() => {
    if (workspaceId && workspacePdfs.length > 0) {
      loadWorkspaceGaps();
    }
  }, [workspacePdfs.length, workspaceId]);

  /* ───────── LOAD CHAT ───────── */

  const loadChat = useCallback(async () => {
    if (!chatId) return;

    setLoadingMessages(true);

    try {
      const token = await getToken();

      const chatRes = await fetch(`${API_BASE}/chat/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const chat = await chatRes.json();
      setChatData(chat);

      const msgRes = await fetch(`${API_BASE}/chat/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const msgs = await msgRes.json();
      setMessages(Array.isArray(msgs) ? msgs : []);

      const pdfRes = await fetch(`${API_BASE}/chat/${chatId}/pdfs`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const pdfs = await pdfRes.json();
      const safePdfs = Array.isArray(pdfs) ? pdfs : [];

      setActivePdfForViewer(safePdfs[0] || null);

    } catch (err) {
      console.error("Chat load failed:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, [chatId, getToken, API_BASE]);

  useEffect(() => {
    if (chatId) loadChat();
  }, [chatId, loadChat]);

  /* ───────── SEND MESSAGE ───────── */

  const sendMessage = async (overrideText = null) => {
    const textToUse = typeof overrideText === 'string' ? overrideText.trim() : input.trim();
    if (!textToUse) return;

    if (typeof overrideText !== 'string') setInput("");

    setMessages(prev => [...prev, { role: 'user', content: textToUse }]);
    setLoadingSend(true);

    try {
      const token = await getToken();

      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId,
          chatId,
          question: textToUse
        })
      });

      const data = await res.json();

      setMessages(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: data.answer,
          sources: data.sources || [] // 🔥 Store sources
        }
      ]);

      if (data.gaps) setResearchGaps(data.gaps);

    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setLoadingSend(false);
    }
  };

  /* ───────── PDF UPLOAD ───────── */

  const [uploading, setUploading] = useState(false);

  const uploadPDFs = async (files) => {
    if (!files?.length || !workspaceId) return;
    
    setUploading(true);
    try {
      const token = await getToken();
      
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("pdf", file);
        formData.append("workspaceId", workspaceId);

        const res = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        if (!res.ok) throw new Error(`Upload failed: ${file.name}`);
      }
      
      // Refresh data
      await loadWorkspacePdfs();
      if (showResearchGaps) await loadWorkspaceGaps();
      
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  /* ───────── RESEARCH GAPS ACTIONS ───────── */

  const handleGenerateAbstract = async (gap) => {
    const gapTitle = typeof gap === 'string' ? gap : gap.title;
    const gapDescription = typeof gap === 'string' ? '' : gap.description;
    
    setGeneratingAbstract(true);
    setViewingAbstract(true);
    setAbstractContent('');
    
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/workspace/${workspaceId}/generate-abstract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ gapTitle, gapDescription })
      });
      
      const data = await res.json();
      if (data.abstract) {
        setAbstractContent(data.abstract);
      } else {
        setAbstractContent("Failed to generate abstract. Please try again.");
      }
    } catch (err) {
      console.error("Failed to generate abstract:", err);
      setAbstractContent("Error generating abstract.");
    } finally {
      setGeneratingAbstract(false);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setShowShareSuccess(true);
      setTimeout(() => setShowShareSuccess(false), 2000);
    });
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };


  const loadWorkspaceGaps = async () => {
    setLoadingGaps(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/workspace/${workspaceId}/research-gaps`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setResearchGaps(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load workspace gaps:", err);
    } finally {
      setLoadingGaps(false);
    }
  };

  /* ───────── AUTO SCROLL ───────── */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ───────── CREATE NEW CHAT ───────── */

  const createNewChat = async () => {
    try {
      const token = await getToken();

      const res = await fetch(`${API_BASE}/chat/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ workspaceId })
      });

      const data = await res.json();
      router.push(`/workspace/${workspaceId}/chat/${data.id}`);

    } catch (err) {
      console.error("Create chat failed:", err);
    }
  };

  /* ───────── UI ───────── */

  if (!isLoaded) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0f0f', color: '#888', fontFamily: 'monospace' }}>Loading...</div>;

  const t = {
    bg: theme === 'dark' ? "#0d0d0d" : "#ffffff",
    bgAlt: theme === 'dark' ? "#111" : "#f8f9fa",
    bgSub: theme === 'dark' ? "#161616" : "#f0f2f5",
    border: theme === 'dark' ? "#1e1e1e" : "#e5e7eb",
    borderAlt: theme === 'dark' ? "#1a1a1a" : "#f3f4f6",
    text: theme === 'dark' ? "#e8e8e8" : "#111827",
    textSub: theme === 'dark' ? "#aaa" : "#4b5563",
    textMuted: theme === 'dark' ? "#666" : "#9ca3af",
    navBg: theme === 'dark' ? "#0d0d0d" : "#ffffff",
    inputBg: theme === 'dark' ? "#181818" : "#f3f4f6",
    cardBg: theme === 'dark' ? "#111" : "#ffffff",
  };

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      height: "100vh", 
      background: t.bg, 
      color: t.text, 
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", 
      overflow: "hidden" 
    }}>

      {/* ── TOP NAV ── */}
      <div style={{ display: "flex", alignItems: "center", height: 48, borderBottom: `1px solid ${t.border}`, padding: "0 16px", gap: 16, flexShrink: 0, background: t.navBg }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #4f8ef7, #7b5ea7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>R</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3, lineHeight: 1 }}>Radium</div>
            <div style={{ fontSize: 9, color: "#555", letterSpacing: 1, textTransform: "uppercase" }}>Research Assistant</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 360, position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: theme === 'dark' ? "#555" : "#999" }} />
          <input 
            placeholder="Search" 
            style={{ 
              width: "100%", 
              background: theme === 'dark' ? "#181818" : "#f5f5f5", 
              border: theme === 'dark' ? "1px solid #252525" : "1px solid #ddd", 
              borderRadius: 20, 
              padding: "6px 12px 6px 30px", 
              fontSize: 12, 
              color: theme === 'dark' ? "#aaa" : "#333", 
              outline: "none", 
              boxSizing: "border-box" 
            }} 
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Right icons */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button 
            className="logo-btn" 
            title="Share workspace"
            onClick={handleShare}
          >
            {showShareSuccess ? <Check size={14} style={{ color: "#4ade80" }} /> : <Share2 size={15} />}
          </button>
          
          <button 
            className="logo-btn" 
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.fullName || user?.username || "Researcher"}</div>
              <div style={{ fontSize: 10, color: "#4f8ef7" }}>{user?.primaryEmailAddress?.emailAddress || "Academic Researcher"}</div>
            </div>
            {user?.imageUrl ? (
              <img src={user.imageUrl} style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #333", objectFit: "cover" }} alt="User" />
            ) : (
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#252525", border: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>👤</div>
            )}
          </div>
        </div>
      </div>

      {/* ── BODY: PDF viewer + Chat | Research Gaps ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", cursor: isDragging ? "col-resize" : "auto", userSelect: isDragging ? "none" : "auto" }}>

        {/* ── LEFT: PDF panel ── */}
        <div style={{ width: `${leftWidth}%`, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: `1px solid ${t.border}`, overflow: "hidden" }}>
          
          {/* PDF Browser Tabs */}
          <div style={{ display: "flex", alignItems: "center", height: 42, borderBottom: `1px solid ${t.border}`, background: t.bgAlt, padding: "0", gap: 0, flexShrink: 0, overflowX: "auto" }}>
            {workspacePdfs.filter(p => !closedTabIds.has(`pdf-${p.pdf_id}`)).map(pdf => {
              const isActive = activePdfForViewer?.pdf_id === pdf.pdf_id;
              return (
                <div
                  key={pdf.pdf_id}
                  onClick={() => setActivePdfForViewer(pdf)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "0 14px", height: "100%",
                    background: isActive ? t.bg : "transparent",
                    borderBottom: isActive ? "2px solid #4f8ef7" : "2px solid transparent",
                    borderRight: `1px solid ${t.border}`,
                    cursor: "pointer", fontSize: 12, fontWeight: isActive ? 500 : 400,
                    color: isActive ? t.text : t.textMuted,
                    whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis",
                    transition: "all 0.15s ease", flexShrink: 0
                  }}
                >
                  <FileText size={12} style={{ color: isActive ? "#4f8ef7" : t.textMuted, flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{pdf.filename}</span>
                  <X size={10} style={{ marginLeft: 4, color: t.textMuted, cursor: "pointer", transition: "color 0.2s" }} 
                     onClick={(e) => { e.stopPropagation(); setClosedTabIds(prev => new Set([...prev, `pdf-${pdf.pdf_id}`])); }} 
                     onMouseEnter={e => e.target.style.color = "#d9534f"} 
                     onMouseLeave={e => e.target.style.color = t.textMuted} 
                  />
                </div>
              );
            })}
            {/* + add PDF tab */}
            <button
              style={{ ...iconBtnStyle, padding: "0 12px", height: "100%", borderRadius: 0, borderRight: `1px solid ${t.border}`, color: t.textMuted, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
              onClick={() => document.getElementById('chat-pdf-upload').click()}
              disabled={uploading}
            >
              {uploading ? (
                <div style={{ width: 12, height: 12, border: "2px solid #555", borderTopColor: "#4f8ef7", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              ) : (
                <Plus size={13} />
              )}
            </button>
            <input 
              id="chat-pdf-upload"
              type="file" 
              multiple 
              accept=".pdf" 
              hidden 
              onChange={(e) => uploadPDFs(e.target.files)}
            />
          </div>

          {/* PDF viewer area */}
          <div style={{ flex: 1, overflow: "auto", background: "#161616", display: "flex", alignItems: activePdfForViewer ? "flex-start" : "center", justifyContent: "center" }}>
            {activePdfForViewer ? (
              <PdfViewer key={activePdfForViewer.pdf_id} pdfId={activePdfForViewer.pdf_id} />
            ) : (
              <div style={{ textAlign: "center", color: "#333" }}>
                <FileText size={40} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 13 }}>No PDF selected</div>
                <div style={{ fontSize: 11, color: "#2a2a2a", marginTop: 4 }}>Open a PDF from the tab bar</div>
              </div>
            )}
          </div>
        </div>

        {/* ── RESIZER ── */}
        <div 
          onMouseDown={handleMouseDown}
          style={{ width: 4, flexShrink: 0, cursor: "col-resize", background: isDragging ? "#4f8ef7" : "transparent", zIndex: 5, transition: "background 0.2s" }}
        />

        {/* ── RIGHT: Chat panel ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: t.bg, flexShrink: 0, position: "relative" }}>

          {/* Chat Browser Tabs */}
          <div style={{ display: "flex", alignItems: "center", height: 42, borderBottom: `1px solid ${t.border}`, background: t.bgAlt, padding: "0", gap: 0, flexShrink: 0, overflowX: "auto" }}>
            {workspaceChats.filter(c => !closedTabIds.has(`chat-${c.id}`)).map(chat => {
              const isActive = chatId === String(chat.id);
              return (
                <div
                  key={chat.id}
                  onClick={() => router.push(`/workspace/${workspaceId}/chat/${chat.id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "0 14px", height: "100%",
                    background: isActive ? t.bg : "transparent",
                    borderBottom: isActive ? "2px solid #4f8ef7" : "2px solid transparent",
                    borderRight: `1px solid ${t.border}`,
                    cursor: "pointer", fontSize: 12, fontWeight: isActive ? 500 : 400,
                    color: isActive ? t.text : t.textMuted,
                    whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis",
                    transition: "all 0.15s ease", flexShrink: 0
                  }}
                >
                  <MessageSquare size={12} style={{ color: isActive ? "#4f8ef7" : t.textMuted, flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{chat.title || "Untitled"}</span>
                  <X size={10} style={{ marginLeft: 4, color: t.textMuted, cursor: "pointer", transition: "color 0.2s" }} 
                     onClick={(e) => { e.stopPropagation(); setClosedTabIds(prev => new Set([...prev, `chat-${chat.id}`])); }} 
                     onMouseEnter={e => e.target.style.color = "#d9534f"} 
                     onMouseLeave={e => e.target.style.color = t.textMuted} 
                  />
                </div>
              );
            })}
            <button
              style={{ ...iconBtnStyle, padding: "0 12px", height: "100%", borderRadius: 0, borderRight: "1px solid #1a1a1a", color: "#555", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
              onClick={createNewChat}
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Chat header */}
          <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, background: "linear-gradient(135deg, #4f8ef7, #7b5ea7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>R</div>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5, color: "#bbb" }}>ASSISTANT CONTEXT</span>
            </div>
            {/* Active PDF badge */}
            {activePdfForViewer && (
              <div style={{ fontSize: 10, color: "#4ade80", background: "#0d2818", border: "1px solid #1a3d25", borderRadius: 10, padding: "2px 8px", marginRight: 8, display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80" }} />
                ACTIVE
              </div>
            )}
            <button
              onClick={() => {
                setShowResearchGaps(v => {
                  if (!v && researchGaps.length === 0) {
                    loadWorkspaceGaps();
                  }
                  return !v;
                });
              }}
              style={{ display: "flex", alignItems: "center", gap: 5, background: showResearchGaps ? "rgba(79, 142, 247, 0.1)" : t.bgAlt, border: "1px solid #4f8ef7", borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: "#4f8ef7", fontSize: 11, fontWeight: 600 }}
            >
              <Sparkles size={11} /> Show Gaps
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0", background: t.bg }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                {m.role === 'assistant' ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg, #4f8ef7, #7b5ea7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 2, color: "#fff" }}>R</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#4f8ef7", fontWeight: 600, marginBottom: 4, letterSpacing: 0.5 }}>RADIUM AI</div>
                      <div className="markdown-content" style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                      {/* Source chips */}
                      {m.sources && m.sources.length > 0 ? (
                        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {m.sources.map((src, sIdx) => {
                            const pdfObj = workspacePdfs.find(p => p.pdf_id === src.pdfId);
                            return (
                              <div 
                                key={sIdx} 
                                style={{ 
                                  display: "inline-flex", alignItems: "center", gap: 5, 
                                  background: t.bgSub, border: `1px solid ${t.border}`, 
                                  borderRadius: 6, padding: "3px 8px", fontSize: 9, 
                                  color: t.textMuted, cursor: "pointer", transition: "all 0.2s"
                                }}
                                onClick={() => {
                                  if (pdfObj) {
                                    setActivePdfForViewer(pdfObj);
                                    // Optionally jump to page if the PDF viewer supports it
                                  }
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#4f8ef7"; e.currentTarget.style.color = t.text; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
                              >
                                <FileText size={10} style={{ color: "#4f8ef7" }} />
                                <span>{pdfObj?.filename || "Document"}</span>
                                <span style={{ opacity: 0.5, marginLeft: 2 }}>p. {src.page}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : activePdfForViewer && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: t.bgAlt, border: `1px solid ${t.borderAlt}`, borderRadius: 6, padding: "3px 8px", fontSize: 10, color: t.textMuted }}>
                            <FileText size={9} /> {activePdfForViewer.filename}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ background: t.bgAlt, border: `1px solid ${t.borderAlt}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, color: t.text, maxWidth: "80%", lineHeight: 1.5 }}>{m.content}</div>
                  </div>
                )}
              </div>
            ))}
            {loadingSend && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg, #4f8ef7, #7b5ea7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>R</div>
                <div style={{ display: "flex", gap: 4, alignItems: "center", paddingTop: 6 }}>
                  {[0, 1, 2].map(n => (
                    <div key={n} style={{ width: 6, height: 6, borderRadius: "50%", background: "#4f8ef7", animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${n * 0.2}s`, opacity: 0.7 }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{ padding: 12, flexShrink: 0, background: t.bg }}>
            <div style={{ background: t.bgAlt, border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "4px 8px 0", display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 10, color: t.textMuted, background: t.bgSub, border: `1px solid ${t.border}`, borderRadius: 4, padding: "2px 6px", letterSpacing: 0.5 }}>⌘ K-SHORTCUT ENABLED</div>
              </div>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={activePdfForViewer ? `Ask Radium about ${activePdfForViewer.filename}...` : "Ask Radium..."}
                rows={2}
                style={{ width: "100%", background: "transparent", border: "none", outline: "none", padding: "8px 12px", fontSize: 13, color: t.text, resize: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              />
              <div style={{ display: "flex", alignItems: "center", padding: "4px 8px 8px", gap: 8 }}>
                <div style={{ fontSize: 10, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 10 }}># SYNTHESIZE</div>
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: t.textMuted }}>PRESS ⌘ TO SEND</span>
                <button
                  onClick={sendMessage}
                  disabled={loadingSend || !input.trim()}
                  style={{ width: 28, height: 28, borderRadius: 7, background: input.trim() ? "linear-gradient(135deg, #4f8ef7, #7b5ea7)" : t.bgSub, border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                >
                  <Send size={12} style={{ color: input.trim() ? "#fff" : t.textMuted }} />
                </button>
              </div>
            </div>
          </div>

        {/* ── OVERLAPPING: Research Gaps panel ── */}
        {showResearchGaps && (
          <div style={{ position: "absolute", top: 42, right: 0, bottom: 0, width: 340, background: t.bg, borderLeft: `1px solid ${t.border}`, display: "flex", flexDirection: "column", zIndex: 10, boxShadow: theme === 'dark' ? "-5px 0 20px rgba(0,0,0,0.5)" : "-5px 0 15px rgba(0,0,0,0.1)" }}>
            
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${t.borderAlt}`, background: t.bgAlt }}>
              {viewingAbstract ? (
                <button 
                  onClick={() => { setViewingAbstract(false); setAbstractContent(''); }}
                  style={{ ...iconBtnStyle, padding: 4, marginRight: 8, color: "#4f8ef7" }}
                >
                  <ChevronLeft size={16} />
                </button>
              ) : (
                <Sparkles size={14} style={{ color: "#4f8ef7", marginRight: 7 }} />
              )}
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                {viewingAbstract ? "Generated Abstract" : "Research Gaps"}
              </span>
              <button 
                onClick={() => { setShowResearchGaps(false); setViewingAbstract(false); }} 
                style={{ ...iconBtnStyle, padding: 4 }}
              >
                <X size={13} />
              </button>
            </div>

            {!viewingAbstract ? (
              <>
                <div style={{ padding: "10px 14px", borderBottom: `1px solid ${t.borderAlt}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: t.bg }}>
                  <span style={{ fontSize: 10, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>Identified Opportunities</span>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  {loadingGaps ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
                      <div style={{ width: 30, height: 30, border: "2px solid #1a1a1a", borderTopColor: "#4f8ef7", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                      <div style={{ fontSize: 11, color: "#555" }}>Analyzing workspace docs...</div>
                    </div>
                  ) : researchGaps.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#333", textAlign: "center", marginTop: 40 }}>No gaps identified yet.</div>
                  ) : (
                    researchGaps.map((gap, i) => (
                      <div key={i} style={{ background: t.bgAlt, border: `1px solid ${t.borderAlt}`, borderRadius: 10, padding: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#1a2a1a", border: "1px solid #2d4a2d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>○</div>
                          <span style={{ fontSize: 10, color: "#c8a04a", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>{gap.type || "RESEARCH GAP"}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 6, lineHeight: 1.4 }}>{typeof gap === 'string' ? gap : gap.title}</div>
                        {gap.description && <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6 }}>{gap.description}</div>}
                        <button 
                          onClick={() => handleGenerateAbstract(gap)}
                          style={{ marginTop: 10, width: "100%", background: "#161616", border: "1px solid #252525", borderRadius: 7, padding: "6px 10px", fontSize: 11, color: "#aaa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                        >
                          Generate Abstract →
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                {generatingAbstract ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
                    <div style={{ width: 30, height: 30, border: "2px solid #1a1a1a", borderTopColor: "#4f8ef7", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                    <div style={{ fontSize: 11, color: "#555" }}>Synthesizing research abstract...</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {abstractContent}
                    </div>
                    <div style={{ marginTop: "auto", padding: "12px", background: "#1a1f2e", border: "1px solid #252f45", borderRadius: 8, fontSize: 11, color: "#4f8ef7" }}>
                      <Sparkles size={12} style={{ marginBottom: 4, display: "block" }} />
                      This abstract was generated based on context from {workspacePdfs.length} documents in this workspace.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        
        </div>
      </div>

      {/* Bottom status bar */}
      <div style={{ height: 28, borderTop: `1px solid ${t.borderAlt}`, background: t.bgAlt, display: "flex", alignItems: "center", padding: "0 16px", gap: 20, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} />
          <span style={{ fontSize: 10, color: t.textMuted }}>AI monitoring 3 sources in real-time</span>
        </div>
        {activePdfForViewer && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <MessageSquare size={10} style={{ color: t.textMuted }} />
            <span style={{ fontSize: 10, color: t.textMuted }}>Active Context: {activePdfForViewer.filename}</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: t.textMuted, letterSpacing: 0.5 }}>RADIUM ACADEMIC ENGINE</span>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${theme === 'dark' ? "#252525" : "#ddd"}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: ${theme === 'dark' ? "#333" : "#ccc"}; }
        textarea::placeholder { color: ${t.textMuted}; }
        input::placeholder { color: ${t.textMuted}; }
        button:hover { opacity: 0.85; }
        .logo-btn {
          color: #aaa;
          width: 32px;
          height: 32px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid #252525;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .logo-btn:hover {
          background: linear-gradient(135deg, #4f8ef7, #7b5ea7) !important;
          color: #fff !important;
          border-color: transparent !important;
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}

const iconBtnStyle = {
  background: "none",
  border: "none",
  color: "#666",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 6,
  borderRadius: 6,
  transition: "color 0.15s"
};