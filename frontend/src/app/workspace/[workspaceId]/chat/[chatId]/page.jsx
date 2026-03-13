'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, History, ChevronLeft, MessageSquare, Plus, PanelLeftClose } from 'lucide-react';
import { useRouter, useParams } from "next/navigation";

export default function WorkspaceChatPage() {
  console.log("🔥 WORKSPACE CHAT (PDF-LESS)");
  
  const { isLoaded } = useUser();
  const { getToken } = useAuth();
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
  const router = useRouter();
  const params = useParams();
  const workspaceId = params?.workspaceId;
  const chatId = params?.chatId;

  // Workspace-driven states (NO PDF)
  const [chatData, setChatData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);
  const [workspaceChats, setWorkspaceChats] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const messagesEndRef = useRef(null);

  // ✅ LOAD WORKSPACE CHAT (no PDF needed)
  const loadChat = useCallback(async (chatId) => {
    if (!chatId || !isLoaded || !workspaceId) return;

    console.log('🔍 Loading workspace chat:', chatId);
    setLoadingMessages(true);

    try {
      const token = await getToken();

      // Load chat metadata
      const chatRes = await fetch(`${API_BASE}/chat/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!chatRes.ok) throw new Error('Chat not found');

      const chatData = await chatRes.json();
      console.log('✅ Chat loaded:', chatData);
      setChatData(chatData);

      // Load messages
      const msgRes = await fetch(`${API_BASE}/chat/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const messagesData = await msgRes.json();
      setMessages(messagesData || []);

    } catch (err) {
      console.error('Load failed:', err);
      router.push(`/workspace/${workspaceId}`);
    } finally {
      setLoadingMessages(false);
    }
  }, [getToken, isLoaded, workspaceId, router]);

  // Watch URL changes
  useEffect(() => {
    if (chatId) {
      loadChat(chatId);
    }
  }, [chatId, loadChat]);

  // Load workspace chats list
  const loadWorkspaceChats = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/workspace/${workspaceId}/chats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkspaceChats(await res.json());
    } catch (err) {
      console.error('Load chats failed:', err);
    }
  }, [getToken, workspaceId]);

  useEffect(() => {
    loadWorkspaceChats();
  }, [loadWorkspaceChats]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ✅ SEND MESSAGE (workspace context only)
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !chatId || !workspaceId) {
      console.warn('Cannot send:', { input: !!input.trim(), chatId, workspaceId });
      return;
    }

    const text = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoadingSend(true);

    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId,  // ✅ Workspace context
          chatId,       // ✅ Chat context
          question: text
          // NO pdfId needed!
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Send failed');
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);

    } catch (err) {
      console.error('Send failed:', err);
      setMessages(prev => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoadingSend(false);
    }
  }, [input, chatId, workspaceId, getToken]);

  const goToWorkspace = () => router.push(`/workspace/${workspaceId}`);

  if (!isLoaded || !workspaceId) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', color: '#888' }}>Loading...</div>;
  }

  const isReady = chatData && !loadingMessages;

  return (
    <>
      <style>{`
        :root {
          --bg-primary: #1a1a1a; --bg-secondary: #222; --bg-tertiary: #2a2a2a; --bg-input: #2e2e2e;
          --bg-hover: #333; --bg-active: #383838; --border: #383838; --border-subtle: #2e2e2e;
          --text-primary: #e8e8e8; --text-secondary: #999; --text-muted: #666;
          --accent-teal: #1db893; --accent-teal-dark: #179e7d; --send-bg: #3a3a3a;
        }
        .app-shell { display: flex; height: 100vh; background: var(--bg-primary); color: var(--text-primary); overflow: hidden; font-family: -apple-system, sans-serif; }
        .sidebar-backdrop { position: fixed; inset: 0; z-index: 40; backdrop-filter: blur(6px); background: rgba(0,0,0,0.45); opacity: 0; pointer-events: none; transition: opacity 0.25s; }
        .sidebar-backdrop.visible { opacity: 1; pointer-events: all; }
        .sidebar { position: fixed; top: 0; left: 0; height: 100vh; z-index: 50; width: 220px; background: var(--bg-secondary); border-right: 1px solid var(--border); transition: transform 0.25s; transform: translateX(-100%); }
        .sidebar.open { transform: translateX(0); }
        .sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 16px 14px; border-bottom: 1px solid var(--border-subtle); }
        .sidebar-title { font-size: 15px; font-weight: 600; }
        .icon-btn { width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .new-chat-btn { display: flex; align-items: center; gap: 8px; margin: 12px 12px 6px; padding: 10px 14px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 13px; font-weight: 500; cursor: pointer; width: calc(100% - 24px); }
        .new-chat-btn:hover { background: var(--bg-hover); }
        .section-label { padding: 10px 16px 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); }
        .sidebar-scroll { flex: 1; overflow-y: auto; padding: 4px 8px; }
        .chat-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 7px; background: transparent; color: var(--text-secondary); font-size: 13px; font-weight: 500; cursor: pointer; text-align: left; transition: all 0.15s; }
        .chat-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .chat-item.active { background: var(--bg-active); color: var(--text-primary); }
        .sidebar-footer { border-top: 1px solid var(--border-subtle); padding: 8px; }
        .footer-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 7px; border: none; background: transparent; color: var(--text-secondary); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
        .footer-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .main-content { flex: 1; display: flex; min-width: 0; overflow: hidden; }
        .workspace-section { flex: 1; display: flex; flex-direction: column; height: 100%; background: var(--bg-primary); }
        .chat-header { height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); }
        .chat-header-title { font-size: 14px; font-weight: 600; }
        .theme-toggle { display: flex; align-items: center; gap: 7px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 20px; padding: 4px 10px 4px 6px; color: var(--text-secondary); font-size: 12px; cursor: pointer; }
        .toggle-track { position: relative; width: 28px; height: 16px; background: var(--border); border-radius: 8px; }
        .toggle-track.on { background: var(--accent-teal); }
        .toggle-thumb { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; background: #fff; border-radius: 50%; transition: transform 0.2s; }
        .toggle-track.on .toggle-thumb { transform: translateX(12px); }
        .chat-messages { flex: 1; overflow-y: auto; padding: 28px 24px; }
        .loading-wrap, .messages-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
        .messages-empty-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
        .messages-empty-sub { font-size: 13px; color: var(--text-muted); max-width: 280px; }
        .spinner { width: 28px; height: 28px; border: 2.5px solid var(--border); border-top-color: var(--accent-teal); border-radius: 50%; animation: spin 0.75s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .messages-list { display: flex; flex-direction: column; gap: 20px; max-width: 680px; margin: 0 auto; }
        .message-row { display: flex; gap: 12px; align-items: flex-start; }
        .message-row.user { flex-direction: row-reverse; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
        .avatar.assistant { background: var(--accent-teal); color: #fff; }
        .avatar.user { background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-secondary); font-size: 11px; }
        .bubble { max-width: 72%; padding: 10px 14px; border-radius: 12px; font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
        .bubble.assistant { background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-subtle); border-top-left-radius: 3px; }
        .bubble.user { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border); border-top-right-radius: 3px; }
        .bubble-meta { font-size: 10.5px; color: var(--text-muted); margin-top: 4px; padding: 0 2px; }
        .message-row.user .bubble-meta { text-align: right; }
        .input-area { padding: 12px 20px 14px; background: var(--bg-primary); border-top: 1px solid var(--border-subtle); }
        .input-wrap { display: flex; align-items: center; gap: 10px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; max-width: 680px; margin: 0 auto; }
        .chat-input { flex: 1; background: transparent; border: none; outline: none; color: var(--text-primary); font-size: 13.5px; resize: none; font-family: inherit; line-height: 1.5; max-height: 120px; overflow-y: auto; }
        .chat-input::placeholder { color: var(--text-muted); }
        .chat-input:disabled { opacity: 0.4; cursor: not-allowed; }
        .send-btn { width: 32px; height: 32px; border-radius: 7px; border: none; background: var(--send-bg); color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .send-btn.active { background: var(--accent-teal); color: #fff; }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .input-disclaimer { text-align: center; font-size: 11px; color: var(--text-muted); margin-top: 8px; max-width: 680px; margin-left: auto; margin-right: auto; }
      `}</style>

      <div className={`app-shell ${isDark ? 'dark' : 'light'}`}>
        {/* SIDEBAR */}
        <div className={`sidebar ${isHistoryOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <span className="sidebar-title">Workspace #{workspaceId?.slice(-4)}</span>
            <button className="icon-btn" onClick={() => setIsHistoryOpen(false)}>
              <PanelLeftClose size={15} />
            </button>
          </div>

          <button className="new-chat-btn" onClick={() => router.push(`/workspace/${workspaceId}`)}>
            <Plus size={14} /> Dashboard
          </button>

          {workspaceChats.length > 0 && (
            <>
              <div className="section-label">Chats</div>
              <div className="sidebar-scroll">
                {workspaceChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => {
                      router.push(`/workspace/${workspaceId}/chat/${chat.id}`);
                      setIsHistoryOpen(false);
                    }}
                    className={`chat-item ${chat.id === chatId ? 'active' : ''}`}
                  >
                    <MessageSquare size={13} />
                    <span>{chat.title?.substring(0, 20) || 'New Chat'}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="sidebar-footer">
            <button className="footer-btn" onClick={goToWorkspace}>
              <ChevronLeft size={14} /> Dashboard
            </button>
          </div>
        </div>

        {/* BACKDROP */}
        <div className={`sidebar-backdrop ${isHistoryOpen ? 'visible' : ''}`} onClick={() => setIsHistoryOpen(false)} />

        {/* MAIN CONTENT - FULL WIDTH CHAT */}
        <div className="main-content">
          <div className="workspace-section">
            <div className="chat-header">
              <span className="chat-header-title">
                {chatData?.title || 'Workspace Chat'}
              </span>
              <button className="theme-toggle" onClick={() => setIsDark(d => !d)}>
                <div className={`toggle-track ${isDark ? 'on' : ''}`}>
                  <div className="toggle-thumb" />
                </div>
                {isDark ? '🌙 Dark' : '☀️ Light'}
              </button>
            </div>

            <div className="chat-messages">
              {loadingMessages ? (
                <div className="loading-wrap">
                  <div className="spinner" />
                  <span>Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="messages-empty">
                  <div className="messages-empty-title">
                    {isReady ? 'Ready to chat!' : 'Select a chat'}
                  </div>
                  <div className="messages-empty-sub">
                    {isReady ? 'Ask anything about your workspace' : 'Open sidebar to select chat'}
                  </div>
                </div>
              ) : (
                <div className="messages-list">
                  {messages.map((msg, i) => (
                    <div key={i} className={`message-row ${msg.role}`}>
                      <div className={`avatar ${msg.role}`}>
                        {msg.role === 'assistant' ? <MessageSquare size={14} /> : 'U'}
                      </div>
                      <div>
                        <div className={`bubble ${msg.role}`}>
                          {msg.content}
                        </div>
                        <div className="bubble-meta">
                          {msg.role === 'assistant' ? 'Assistant' : 'You'}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="input-area">
              <div className="input-wrap">
                <textarea
                  className="chat-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={isReady ? 'Type your message...' : 'Select chat first'}
                  disabled={!isReady || loadingSend}
                  rows="1"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button
                  className={`send-btn ${input.trim() && isReady && !loadingSend ? 'active' : ''}`}
                  onClick={sendMessage}
                  disabled={!input.trim() || !isReady || loadingSend}
                >
                  {loadingSend ? (
                    <div style={{width:14,height:14,border:'1.5px solid transparent',borderTop:'1.5px solid white',borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
              <div className="input-disclaimer">
                Workspace AI can make mistakes. Verify important info.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
