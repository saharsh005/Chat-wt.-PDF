'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Send, History, ChevronLeft, X, MessageSquare, FileText, Plus, Settings, ExternalLink, Paperclip, PanelLeftClose } from 'lucide-react';
import { useRouter, useParams } from "next/navigation";
import PdfViewer from "../../../component/PdfViewer.jsx";


export default function ChatPage() {
  console.log("🔥 THIS CHAT PAGE IS RUNNING");
  const { isLoaded } = useUser();
  const { getToken } = useAuth();
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
  const router = useRouter();
  const params = useParams();
  const routeChatId = params?.chatId;

  // URL controls these states completely
  const [pdfId, setPdfId] = useState(null);
  const [chatData, setChatData] = useState(null); // Single source of chat truth
  const [messages, setMessages] = useState([]);
  
  // UI states (independent of URL)
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [chats, setChats] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const messagesEndRef = useRef(null);

  // Function to truncate chat title
  const truncateTitle = (title) => {
    if (!title) return 'New Chat';
    const cleanTitle = title.replace(/\.[^/.]+$/, '');
    return cleanTitle.length <= 20 ? cleanTitle : cleanTitle.substring(0, 17) + '...';
  };

  // Load chats list (for sidebar only)
  const loadChats = useCallback(async () => {
    if (!isLoaded) return;
    try {
      const token = await getToken();
      console.log('🔍 Loading chats from:', 'http://localhost:5000/chat');
      const res = await fetch('http://localhost:5000/chat', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setChats(data || []);
    } catch (err) {
      console.error('Load chats failed', err);
    }
  }, [getToken, isLoaded]);

  // 🔥 CORE: Load everything from URL/chatId
  const loadChatFromUrl = useCallback(async (chatId) => {
    if (!chatId || !isLoaded) return;

    setLoadingMessages(true);
    setMessages([]);

    try {
      const token = await getToken();

      console.log('🔍 Loading chat:', `${API_BASE}/chat/${chatId}`);
      const chatRes = await fetch(`http://localhost:5000/chat/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!chatRes.ok) {
        throw new Error('Chat not found');
      }

      const chatData = await chatRes.json();
      setChatData(chatData);
      setPdfId(chatData.pdf_id);

      console.log('🔍 Loading messages:', `${API_BASE}/chat/${chatId}/messages`);
      const msgRes = await fetch(`http://localhost:5000/chat/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const messagesData = await msgRes.json();
      setMessages(messagesData || []);

    } catch (err) {
      console.error("Failed to load chat:", err);
      setChatData(null);
      setPdfId(null);
      setMessages([]);
      router.push('/');
    } finally {
      setLoadingMessages(false);
    }
  }, [getToken, isLoaded, router]);

  // 🔥 URL CONTROLS EVERYTHING: Watch routeChatId changes
  useEffect(() => {
    if (routeChatId) {
      loadChatFromUrl(routeChatId);
    } else {
      setChatData(null);
      setPdfId(null);
      setMessages([]);
    }
  }, [routeChatId, loadChatFromUrl]);

  // Load chats list on mount
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* UPLOAD & CREATE NEW CHAT (updates URL) */
  const uploadPDF = async (file) => {
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const token = await getToken();
      
      const uploadRes = await fetch(`http://localhost:5000/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();

      // Upload already creates chat
      router.push(`/chat/${uploadData.chatId}`);

    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  /* SEND MESSAGE (current chat from URL) */
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !pdfId || !routeChatId) {
      console.warn("❌ Missing data:", { hasInput: !!input.trim(), hasPdfId: !!pdfId, hasChatId: !!routeChatId });
      return;
    }

    const text = input.trim();
    const userMessage = { role: "user", content: text };

    setMessages(prev => [...prev, userMessage]);
    setInput("");

    try {
      const token = await getToken();
      const res = await fetch(`http://localhost:5000/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pdfId,
          chatId: routeChatId,
          question: text
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Chat request failed");
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
      setCurrentPage(data.page || 1);

    } catch (err) {
      console.error("❌ Send failed:", err.message);
      setMessages(prev => prev.slice(0, -1));
      setInput(text);
    }
  }, [input, pdfId, routeChatId, getToken]);

  // Click chat from history → Navigate to URL
  const selectChat = (chat) => {
    router.push(`/chat/${chat.id}`);
    setIsHistoryOpen(false);
  };

  // Go home (clear URL)
  const goHome = () => {
    router.push('/');
  };

  if (!isLoaded) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' }}>
        <div style={{ color: '#888', fontSize: '14px', fontFamily: 'system-ui, sans-serif' }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        :root {
          --bg-primary: #1a1a1a;
          --bg-secondary: #222222;
          --bg-tertiary: #2a2a2a;
          --bg-input: #2e2e2e;
          --bg-hover: #333333;
          --bg-active: #383838;
          --border: #383838;
          --border-subtle: #2e2e2e;
          --text-primary: #e8e8e8;
          --text-secondary: #999999;
          --text-muted: #666666;
          --accent-teal: #1db893;
          --accent-teal-dark: #179e7d;
          --accent-teal-bg: rgba(29, 184, 147, 0.12);
          --send-bg: #3a3a3a;
          --send-hover: #444444;
        }

        .app-shell.light {
          --bg-primary: #f5f5f5;
          --bg-secondary: #ffffff;
          --bg-tertiary: #efefef;
          --bg-input: #f0f0f0;
          --bg-hover: #e8e8e8;
          --bg-active: #e0e0e0;
          --border: #dcdcdc;
          --border-subtle: #e8e8e8;
          --text-primary: #111111;
          --text-secondary: #555555;
          --text-muted: #999999;
          --accent-teal: #1db893;
          --accent-teal-dark: #179e7d;
          --accent-teal-bg: rgba(29, 184, 147, 0.10);
          --send-bg: #e2e2e2;
          --send-hover: #d5d5d5;
        }

        /* ── THEME TOGGLE ── */
        .theme-toggle {
          display: flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 4px 10px 4px 6px;
          transition: background 0.2s, border-color 0.2s;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
        }
        .theme-toggle:hover { background: var(--bg-hover); }

        .toggle-track {
          position: relative;
          width: 28px;
          height: 16px;
          background: var(--border);
          border-radius: 8px;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .toggle-track.on { background: var(--accent-teal); }
        .toggle-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 12px;
          height: 12px;
          background: #fff;
          border-radius: 50%;
          transition: transform 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .toggle-track.on .toggle-thumb { transform: translateX(12px); }

        .app-shell {
          display: flex;
          height: 100vh;
          background: var(--bg-primary);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: var(--text-primary);
          overflow: hidden;
        }

        /* ── SIDEBAR OVERLAY BACKDROP ── */
        .sidebar-backdrop {
          position: fixed;
          inset: 0;
          z-index: 40;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          background: rgba(0, 0, 0, 0.45);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.25s ease;
        }
        .sidebar-backdrop.visible {
          opacity: 1;
          pointer-events: all;
        }

        /* ── SIDEBAR ── */
        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          z-index: 50;
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          transition: transform 0.25s ease, opacity 0.25s ease;
          width: 220px;
          overflow: hidden;
          flex-shrink: 0;
        }
        .sidebar.open { transform: translateX(0); opacity: 1; pointer-events: all; }
        .sidebar.closed { transform: translateX(-100%); opacity: 0; pointer-events: none; }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 16px 14px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .sidebar-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: 0.01em;
        }
        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

        .new-chat-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 12px 12px 6px;
          padding: 10px 14px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          text-align: left;
          width: calc(100% - 24px);
        }
        .new-chat-btn:hover { background: var(--bg-hover); border-color: #444; }
        .new-chat-btn svg { color: var(--text-secondary); flex-shrink: 0; }

        .section-label {
          padding: 10px 16px 4px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .sidebar-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 4px 8px;
        }
        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

        .chat-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 9px 10px;
          border-radius: 7px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chat-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .chat-item.active { background: var(--bg-active); color: var(--text-primary); }
        .chat-item svg { flex-shrink: 0; color: var(--text-muted); }
        .chat-item-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .sidebar-footer {
          border-top: 1px solid var(--border-subtle);
          padding: 8px;
        }
        .footer-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 9px 10px;
          border-radius: 7px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          text-align: left;
        }
        .footer-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

        /* ── MAIN CONTENT ── */
        .main-content {
          flex: 1;
          display: flex;
          min-width: 0;
          overflow: hidden;
        }

        /* ── PDF SECTION ── */
        .pdf-section {
          display: flex;
          flex-direction: column;
          height: 100%;
          border-right: 1px solid var(--border);
          background: var(--bg-primary);
          flex-shrink: 0;
        }

        .pdf-toolbar {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 0 12px;
          height: 48px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .toolbar-filename {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
          margin-right: 8px;
        }
        .toolbar-divider {
          width: 1px;
          height: 18px;
          background: var(--border);
          margin: 0 8px;
          flex-shrink: 0;
        }
        .toolbar-page {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--text-secondary);
          margin-right: 4px;
          white-space: nowrap;
        }
        .toolbar-page span { color: var(--text-muted); }
        .toolbar-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          margin-left: auto;
        }
        .toolbar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 5px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .toolbar-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

        .pdf-body {
          flex: 1;
          overflow: hidden;
        }

        /* Upload empty state */
        .upload-empty {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }
        .upload-zone {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border: 1.5px dashed var(--border);
          border-radius: 12px;
          padding: 48px 36px;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          text-align: center;
          max-width: 280px;
        }
        .upload-zone:hover { border-color: var(--accent-teal); background: var(--accent-teal-bg); }
        .upload-icon-wrap {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }
        .upload-label { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .upload-sub { font-size: 12px; color: var(--text-muted); }

        /* ── CHAT SECTION ── */
        .chat-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-primary);
          min-width: 0;
        }

        .chat-header {
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .chat-header-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: 0.01em;
        }
        .uploading-badge {
          font-size: 11px;
          padding: 3px 10px;
          border-radius: 20px;
          background: var(--accent-teal-bg);
          color: var(--accent-teal);
          font-weight: 500;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 28px 24px;
        }
        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-track { background: transparent; }
        .chat-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

        /* Empty states */
        .messages-empty {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px;
        }
        .messages-empty-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
        }
        .messages-empty-sub {
          font-size: 13px;
          color: var(--text-muted);
          max-width: 280px;
        }

        /* Loading spinner */
        .loading-wrap {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }
        .spinner {
          width: 28px;
          height: 28px;
          border: 2.5px solid var(--border);
          border-top-color: var(--accent-teal);
          border-radius: 50%;
          animation: spin 0.75s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-text { font-size: 13px; color: var(--text-muted); }

        /* Messages */
        .messages-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 680px;
          margin: 0 auto;
        }

        .message-row {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .message-row.user { flex-direction: row-reverse; }

        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .avatar.assistant {
          background: var(--accent-teal);
          color: #fff;
        }
        .avatar.user {
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 11px;
        }

        .bubble {
          max-width: 72%;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 13.5px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .bubble.assistant {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-subtle);
          border-top-left-radius: 3px;
        }
        .bubble.user {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-top-right-radius: 3px;
        }

        .bubble-meta {
          font-size: 10.5px;
          color: var(--text-muted);
          margin-top: 4px;
          padding: 0 2px;
        }
        .message-row.user .bubble-meta { text-align: right; }

        /* ── INPUT ── */
        .input-area {
          padding: 12px 20px 14px;
          background: var(--bg-primary);
          border-top: 1px solid var(--border-subtle);
          flex-shrink: 0;
        }
        .input-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 12px;
          transition: border-color 0.2s;
          max-width: 680px;
          margin: 0 auto;
        }
        .input-wrap:focus-within { border-color: #555; }

        .attach-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          flex-shrink: 0;
          transition: color 0.15s;
        }
        .attach-btn:hover { color: var(--text-secondary); }

        .chat-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: 13.5px;
          resize: none;
          font-family: inherit;
          line-height: 1.5;
          max-height: 120px;
          overflow-y: auto;
        }
        .chat-input::placeholder { color: var(--text-muted); }
        .chat-input:disabled { opacity: 0.4; cursor: not-allowed; }

        .send-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 7px;
          border: none;
          background: var(--send-bg);
          color: var(--text-secondary);
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }
        .send-btn.active { background: var(--accent-teal); color: #fff; }
        .send-btn.active:hover { background: var(--accent-teal-dark); }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .input-disclaimer {
          text-align: center;
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 8px;
          max-width: 680px;
          margin-left: auto;
          margin-right: auto;
        }

        /* Scrollbar polish */
        * { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
      `}</style>

      <div className={`app-shell ${isDark ? 'dark' : 'light'}`}>

        {/* ── SIDEBAR ── */}
        <div className={`sidebar ${isHistoryOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <span className="sidebar-title">History</span>
            <button className="icon-btn" onClick={() => setIsHistoryOpen(false)} title="Close sidebar">
              <PanelLeftClose size={15} />
            </button>
          </div>

          {/* New PDF Chat */}
          <label className="new-chat-btn" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={14} />
            New PDF Chat
            <input type="file" accept=".pdf" hidden onChange={(e) => uploadPDF(e.target.files?.[0])} />
          </label>

          {chats.length > 0 && (
            <div className="section-label">Recent</div>
          )}

          <div className="sidebar-scroll">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => selectChat(chat)}
                className={`chat-item ${chatData?.id === chat.id ? 'active' : ''}`}
              >
                <MessageSquare size={13} />
                <span className="chat-item-text">{truncateTitle(chat.title)}</span>
              </button>
            ))}
            {chats.length === 0 && (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No conversations yet
              </div>
            )}
          </div>

          <div className="sidebar-footer">
            <button className="footer-btn">
              <Settings size={14} />
              Settings
            </button>
            <button className="footer-btn">
              <ExternalLink size={14} />
              Upgrade Plan
            </button>
          </div>
        </div>

        {/* ── SIDEBAR BACKDROP (blur overlay) ── */}
        <div
          className={`sidebar-backdrop ${isHistoryOpen ? 'visible' : ''}`}
          onClick={() => setIsHistoryOpen(false)}
        />

        {/* ── MAIN CONTENT ── */}
        <div className="main-content">

          {/* ── PDF SECTION ── */}
          <div
            className="pdf-section"
            style={{ width: '50%' }}
          >
            {/* PDF Toolbar */}
            <div className="pdf-toolbar">
              <button className="toolbar-btn" onClick={() => setIsHistoryOpen(true)} title="Open history" style={{ marginRight: 4 }}>
                <History size={15} />
              </button>

              {pdfId ? (
                <>
                  <span className="toolbar-filename">
                    {chatData ? chatData.title : `PDF: ${pdfId.slice(0, 10)}...`}
                  </span>
                  <div className="toolbar-divider" />
                  <div className="toolbar-page">
                    <span>{currentPage}</span>
                    <span>/</span>
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  </div>
                </>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No document loaded</span>
              )}

              <div className="toolbar-actions">
                {pdfId && (
                  <button className="toolbar-btn" onClick={goHome} title="Close document">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* PDF Body */}
            <div className="pdf-body">
              {pdfId ? (
                <PdfViewer pdfId={pdfId} page={currentPage} />
              ) : (
                <div className="upload-empty">
                  <label style={{ cursor: 'pointer' }}>
                    <div className="upload-zone">
                      <div className="upload-icon-wrap">
                        <Upload size={22} color="var(--text-muted)" />
                      </div>
                      <div className="upload-label">Upload PDF</div>
                      <div className="upload-sub">Click to select a file</div>
                    </div>
                    <input type="file" accept=".pdf" hidden onChange={(e) => uploadPDF(e.target.files?.[0])} />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* ── CHAT SECTION ── */}
          <div className="chat-section">
            {/* Chat Header */}
            <div className="chat-header">
              <span className="chat-header-title">Chat with PDF</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {uploading && (
                  <span className="uploading-badge">Uploading...</span>
                )}
                <button className="theme-toggle" onClick={() => setIsDark(d => !d)}>
                  <div className={`toggle-track ${isDark ? 'on' : ''}`}>
                    <div className="toggle-thumb" />
                  </div>
                  {isDark ? '🌙 Dark' : '☀️ Light'}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {loadingMessages ? (
                <div className="loading-wrap">
                  <div className="spinner" />
                  <span className="loading-text">Loading chat...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="messages-empty">
                  <div>
                    <div className="messages-empty-title">
                      {pdfId ? 'Ready to chat!' : 'Select a chat or upload a PDF'}
                    </div>
                    <div className="messages-empty-sub">
                      {pdfId
                        ? 'Ask anything about your document'
                        : 'Upload a PDF or choose from your chat history to get started'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="messages-list">
                  {messages.map((message, index) => (
                    <div key={index} className={`message-row ${message.role}`}>
                      <div className={`avatar ${message.role}`}>
                        {message.role === 'assistant'
                          ? <MessageSquare size={14} />
                          : 'U'}
                      </div>
                      <div>
                        <div className={`bubble ${message.role}`}>
                          {message.content}
                        </div>
                        <div className="bubble-meta">
                          {message.role === 'assistant' ? 'Assistant' : 'You'}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="input-area">
              <div className="input-wrap">
                <label className="attach-btn" title="Upload PDF">
                  <Paperclip size={16} />
                  <input type="file" accept=".pdf" hidden onChange={(e) => uploadPDF(e.target.files?.[0])} />
                </label>

                <textarea
                  className="chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={pdfId ? "Message AI..." : "Select chat first"}
                  disabled={!pdfId || !routeChatId || uploading}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />

                <button
                  className={`send-btn ${input.trim() && pdfId && routeChatId && !uploading ? 'active' : ''}`}
                  onClick={sendMessage}
                  disabled={!input.trim() || !pdfId || !routeChatId || uploading}
                  title="Send"
                >
                  <Send size={14} />
                </button>
              </div>
              <div className="input-disclaimer">
                PDF Chat can make mistakes. Check important info.
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}