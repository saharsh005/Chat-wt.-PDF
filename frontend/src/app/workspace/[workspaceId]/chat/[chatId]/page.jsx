'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageSquare, Plus, PanelLeftClose, FileText, Search, Share2, Download, Settings, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, MoreHorizontal, Paperclip, Sparkles, X } from 'lucide-react';
import { useRouter, useParams } from "next/navigation";
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
        { role: 'assistant', content: data.answer }
      ]);

      if (data.gaps) setResearchGaps(data.gaps);

    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setLoadingSend(false);
    }
  };

  /* ───────── RESEARCH GAPS ACTIONS ───────── */

  const handleGenerateAbstract = (gap) => {
    const gapTitle = typeof gap === 'string' ? gap : gap.title;
    sendMessage(`Please generate a detailed research abstract addressing the following research gap: "${gapTitle}"`);
    setShowResearchGaps(false);
  };

  const handleExportInsights = () => {
    if (!researchGaps || researchGaps.length === 0) return;
    
    let report = "# Research Gaps & Insights Report\n\n";
    researchGaps.forEach((gap, i) => {
      report += `## ${i + 1}. ${gap.type || "Identified Gap"}\n`;
      report += `**Title:** ${typeof gap === 'string' ? gap : gap.title}\n`;
      if (gap.description) report += `**Description:** ${gap.description}\n\n`;
    });

    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `radium_research_gaps_${chatId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0d0d0d", color: "#e8e8e8", fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", overflow: "hidden" }}>

      {/* ── TOP NAV ── */}
      <div style={{ display: "flex", alignItems: "center", height: 48, borderBottom: "1px solid #1e1e1e", padding: "0 16px", gap: 16, flexShrink: 0, background: "#0d0d0d" }}>
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
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#555" }} />
          <input placeholder="Search across current workspace..." style={{ width: "100%", background: "#181818", border: "1px solid #252525", borderRadius: 20, padding: "6px 12px 6px 30px", fontSize: 12, color: "#aaa", outline: "none", boxSizing: "border-box" }} />
        </div>

        <div style={{ flex: 1 }} />

        {/* Right icons */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button style={iconBtnStyle}><Share2 size={15} /></button>
          <button style={iconBtnStyle}><Download size={15} /></button>
          <button style={iconBtnStyle}><Settings size={15} /></button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Researcher Alpha</div>
              <div style={{ fontSize: 10, color: "#4f8ef7" }}>Pro Researcher</div>
            </div>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#252525", border: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>👤</div>
          </div>
        </div>
      </div>

      {/* ── BODY: PDF viewer + Chat | Research Gaps ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", cursor: isDragging ? "col-resize" : "auto", userSelect: isDragging ? "none" : "auto" }}>

        {/* ── LEFT: PDF panel ── */}
        <div style={{ width: `${leftWidth}%`, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid #1a1a1a", overflow: "hidden" }}>
          
          {/* PDF Browser Tabs */}
          <div style={{ display: "flex", alignItems: "center", height: 42, borderBottom: "1px solid #1a1a1a", background: "#0d0d0d", padding: "0", gap: 0, flexShrink: 0, overflowX: "auto" }}>
            {workspacePdfs.filter(p => !closedTabIds.has(`pdf-${p.pdf_id}`)).map(pdf => {
              const isActive = activePdfForViewer?.pdf_id === pdf.pdf_id;
              return (
                <div
                  key={pdf.pdf_id}
                  onClick={() => setActivePdfForViewer(pdf)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "0 14px", height: "100%",
                    background: isActive ? "#181818" : "transparent",
                    borderBottom: isActive ? "2px solid #4f8ef7" : "2px solid transparent",
                    borderRight: "1px solid #1a1a1a",
                    cursor: "pointer", fontSize: 12, fontWeight: isActive ? 500 : 400,
                    color: isActive ? "#e8e8e8" : "#666",
                    whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis",
                    transition: "all 0.15s ease", flexShrink: 0
                  }}
                >
                  <FileText size={12} style={{ color: isActive ? "#4f8ef7" : "#444", flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{pdf.filename}</span>
                  <X size={10} style={{ marginLeft: 4, color: "#666", cursor: "pointer", transition: "color 0.2s" }} 
                     onClick={(e) => { e.stopPropagation(); setClosedTabIds(prev => new Set([...prev, `pdf-${pdf.pdf_id}`])); }} 
                     onMouseEnter={e => e.target.style.color = "#d9534f"} 
                     onMouseLeave={e => e.target.style.color = "#666"} 
                  />
                </div>
              );
            })}
            {/* + add PDF tab */}
            <button
              style={{ ...iconBtnStyle, padding: "0 12px", height: "100%", borderRadius: 0, borderRight: "1px solid #1a1a1a", color: "#555", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
              onClick={() => {/* open pdf picker */}}
            >
              <Plus size={13} />
            </button>
          </div>
          {/* PDF toolbar */}
          {activePdfForViewer && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 38, padding: "0 12px", borderBottom: "1px solid #1a1a1a", background: "#111", flexShrink: 0 }}>
              <FileText size={13} style={{ color: "#555" }} />
              <span style={{ fontSize: 12, color: "#aaa", fontWeight: 500 }}>{activePdfForViewer.filename}</span>
              <div style={{ flex: 1 }} />
              <button style={iconBtnStyle}><ChevronLeft size={13} /></button>
              <span style={{ fontSize: 11, color: "#666" }}>1 / 12</span>
              <button style={iconBtnStyle}><ChevronRight size={13} /></button>
              <div style={{ width: 1, height: 16, background: "#252525", margin: "0 4px" }} />
              <button style={iconBtnStyle}><ZoomOut size={13} /></button>
              <span style={{ fontSize: 11, color: "#666", minWidth: 36, textAlign: "center" }}>100%</span>
              <button style={iconBtnStyle}><ZoomIn size={13} /></button>
              <div style={{ width: 1, height: 16, background: "#252525", margin: "0 4px" }} />
              <button style={iconBtnStyle}><Maximize2 size={13} /></button>
              <button style={iconBtnStyle}><MoreHorizontal size={13} /></button>
            </div>
          )}

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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0d0d0d", flexShrink: 0, position: "relative" }}>

          {/* Chat Browser Tabs */}
          <div style={{ display: "flex", alignItems: "center", height: 42, borderBottom: "1px solid #1a1a1a", background: "#0d0d0d", padding: "0", gap: 0, flexShrink: 0, overflowX: "auto" }}>
            {workspaceChats.filter(c => !closedTabIds.has(`chat-${c.id}`)).map(chat => {
              const isActive = chatId === String(chat.id);
              return (
                <div
                  key={chat.id}
                  onClick={() => router.push(`/workspace/${workspaceId}/chat/${chat.id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "0 14px", height: "100%",
                    background: isActive ? "#181818" : "transparent",
                    borderBottom: isActive ? "2px solid #4f8ef7" : "2px solid transparent",
                    borderRight: "1px solid #1a1a1a",
                    cursor: "pointer", fontSize: 12, fontWeight: isActive ? 500 : 400,
                    color: isActive ? "#e8e8e8" : "#666",
                    whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis",
                    transition: "all 0.15s ease", flexShrink: 0
                  }}
                >
                  <MessageSquare size={12} style={{ color: isActive ? "#4f8ef7" : "#444", flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{chat.title || "Untitled"}</span>
                  <X size={10} style={{ marginLeft: 4, color: "#666", cursor: "pointer", transition: "color 0.2s" }} 
                     onClick={(e) => { e.stopPropagation(); setClosedTabIds(prev => new Set([...prev, `chat-${chat.id}`])); }} 
                     onMouseEnter={e => e.target.style.color = "#d9534f"} 
                     onMouseLeave={e => e.target.style.color = "#666"} 
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
              onClick={() => setShowResearchGaps(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 5, background: showResearchGaps ? "#1a2a4a" : "#1a1f2e", border: "1px solid #2a3a5e", borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: "#4f8ef7", fontSize: 11, fontWeight: 600 }}
            >
              <Sparkles size={11} /> Show Gaps
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                {m.role === 'assistant' ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg, #4f8ef7, #7b5ea7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>R</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#4f8ef7", fontWeight: 600, marginBottom: 4, letterSpacing: 0.5 }}>RADIUM AI</div>
                      <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6 }}>{m.content}</div>
                      {/* Source chips */}
                      {activePdfForViewer && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#181818", border: "1px solid #252525", borderRadius: 6, padding: "3px 8px", fontSize: 10, color: "#666" }}>
                            <FileText size={9} /> {activePdfForViewer.filename}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ background: "#1a1f2e", border: "1px solid #252f45", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#ccc", maxWidth: "80%", lineHeight: 1.5 }}>{m.content}</div>
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
          <div style={{ padding: 12, flexShrink: 0 }}>
            <div style={{ background: "#111", border: "1px solid #252525", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "4px 8px 0", display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 10, color: "#333", background: "#1a1a1a", border: "1px solid #222", borderRadius: 4, padding: "2px 6px", letterSpacing: 0.5 }}>⌘ K-SHORTCUT ENABLED</div>
              </div>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={activePdfForViewer ? `Ask Radium about ${activePdfForViewer.filename}...` : "Ask Radium..."}
                rows={2}
                style={{ width: "100%", background: "transparent", border: "none", outline: "none", padding: "8px 12px", fontSize: 13, color: "#ccc", resize: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              />
              <div style={{ display: "flex", alignItems: "center", padding: "4px 8px 8px", gap: 8 }}>
                <div style={{ fontSize: 10, color: "#333", display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 10, color: "#2a2a2a" }}># SYNTHESIZE</div>
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: "#333" }}>PRESS ⌘ TO SEND</span>
                <button
                  onClick={sendMessage}
                  disabled={loadingSend || !input.trim()}
                  style={{ width: 28, height: 28, borderRadius: 7, background: input.trim() ? "linear-gradient(135deg, #4f8ef7, #7b5ea7)" : "#1a1a1a", border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                >
                  <Send size={12} style={{ color: input.trim() ? "#fff" : "#333" }} />
                </button>
              </div>
            </div>
          </div>

        {/* ── OVERLAPPING: Research Gaps panel ── */}
        {showResearchGaps && (
          <div style={{ position: "absolute", top: 42, right: 0, bottom: 0, width: 340, background: "#0d0d0d", borderLeft: "1px solid #1a1a1a", display: "flex", flexDirection: "column", zIndex: 10, boxShadow: "-5px 0 20px rgba(0,0,0,0.5)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid #1a1a1a" }}>
              <Sparkles size={14} style={{ color: "#4f8ef7", marginRight: 7 }} />
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Research Gaps</span>
              <button onClick={() => setShowResearchGaps(false)} style={{ ...iconBtnStyle, padding: 4 }}><X size={13} /></button>
            </div>

            <div style={{ padding: "10px 14px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: "#444", letterSpacing: 1, textTransform: "uppercase" }}>Identified Opportunities</span>
              <button 
                onClick={loadWorkspaceGaps}
                disabled={loadingGaps}
                style={{ background: "none", border: "none", color: "#4f8ef7", fontSize: 10, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
              >
                <Search size={10} /> {loadingGaps ? "Scanning..." : "Scan Workspace"}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {loadingGaps ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
                  <div style={{ width: 30, height: 30, border: "2px solid #1a1a1a", borderTopColor: "#4f8ef7", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  <div style={{ fontSize: 11, color: "#555" }}>Analyzing all workspace docs...</div>
                </div>
              ) : researchGaps.length === 0 ? (
                <div style={{ fontSize: 12, color: "#333", textAlign: "center", marginTop: 40 }}>No gaps identified yet.<br />Click "Scan Workspace" to analyze.</div>
              ) : (
                researchGaps.map((gap, i) => (
                  <div key={i} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#1a2a1a", border: "1px solid #2d4a2d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>○</div>
                      <span style={{ fontSize: 10, color: "#c8a04a", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>{gap.type || "RESEARCH GAP"}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0", marginBottom: 6, lineHeight: 1.4 }}>{typeof gap === 'string' ? gap : gap.title}</div>
                    {gap.description && <div style={{ fontSize: 12, color: "#777", lineHeight: 1.6 }}>{gap.description}</div>}
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

            {/* Export button */}
            <div style={{ padding: 12, borderTop: "1px solid #1a1a1a" }}>
              <button 
                onClick={handleExportInsights}
                style={{ width: "100%", background: "linear-gradient(135deg, #4f8ef7, #7b5ea7)", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}
              >
                Export Insights Report
              </button>
            </div>
          </div>
        )}
        
        </div>
      </div>

      {/* Bottom status bar */}
      <div style={{ height: 28, borderTop: "1px solid #1a1a1a", background: "#0a0a0a", display: "flex", alignItems: "center", padding: "0 16px", gap: 20, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} />
          <span style={{ fontSize: 10, color: "#555" }}>AI monitoring 3 sources in real-time</span>
        </div>
        {activePdfForViewer && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <MessageSquare size={10} style={{ color: "#555" }} />
            <span style={{ fontSize: 10, color: "#555" }}>Active Context: {activePdfForViewer.filename}</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: "#333", letterSpacing: 0.5 }}>RADIUM ACADEMIC ENGINE</span>
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
        ::-webkit-scrollbar-thumb { background: #252525; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #333; }
        textarea::placeholder { color: #444; }
        input::placeholder { color: #444; }
        button:hover { opacity: 0.85; }
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