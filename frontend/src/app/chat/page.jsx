"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Upload, MessageSquare, Plus, Settings, ExternalLink, FileText, Moon, Sun } from "lucide-react";

const API_BASE = "http://localhost:5000";

export default function ChatIndexPage() {
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    const loadChats = async () => {
      try {
        const token = await getToken();

        const res = await fetch(`${API_BASE}/chat`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to load chats");
        }

        const data = await res.json();
        setChats(data || []);
      } catch (err) {
        console.error("Failed to load chat list:", err);
      } finally {
        setLoading(false);
      }
    };

    loadChats();
  }, [isLoaded, getToken]);

  const uploadPDF = async (file) => {
    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const token = await getToken();

      const uploadRes = await fetch(`http://localhost:5000/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const text = await uploadRes.text();
      console.log("Upload response:", text);

      if (!uploadRes.ok) {
        throw new Error("Upload failed");
      }

      const uploadData = JSON.parse(text);

      const chatRes = await fetch(`http://localhost:5000/chat/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pdfId: uploadData.pdfId })
      });

      const newChat = await chatRes.json();
      router.push(`/chat/${newChat.id}`);

    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const openChat = (chatId) => {
    router.push(`/chat/${chatId}`);
  };

  const truncateTitle = (title) => {
    if (!title) return 'Untitled Chat';
    const clean = title.replace(/\.[^/.]+$/, '');
    return clean.length <= 22 ? clean : clean.substring(0, 19) + '...';
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .index-shell {
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
        }

        .index-shell.light {
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
        }

        .index-shell {
          display: flex;
          height: 100vh;
          background: var(--bg-primary);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: var(--text-primary);
          overflow: hidden;
        }

        /* ── SIDEBAR ── */
        .idx-sidebar {
          width: 220px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          height: 100%;
        }

        .idx-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 16px 14px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .idx-sidebar-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: 0.01em;
        }

        .idx-theme-btn {
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
        .idx-theme-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

        .idx-new-btn {
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
        .idx-new-btn:hover { background: var(--bg-hover); border-color: #444; }
        .idx-new-btn svg { color: var(--text-secondary); flex-shrink: 0; }

        .idx-section-label {
          padding: 10px 16px 4px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .idx-chat-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 4px 8px;
        }
        .idx-chat-scroll::-webkit-scrollbar { width: 3px; }
        .idx-chat-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

        .idx-chat-item {
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
          overflow: hidden;
        }
        .idx-chat-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .idx-chat-item svg { flex-shrink: 0; color: var(--text-muted); }
        .idx-chat-item-inner { overflow: hidden; }
        .idx-chat-name {
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: inherit;
        }
        .idx-chat-date {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 1px;
        }

        .idx-empty-chats {
          padding: 24px 12px;
          text-align: center;
          color: var(--text-muted);
          font-size: 12px;
        }

        .idx-sidebar-footer {
          border-top: 1px solid var(--border-subtle);
          padding: 8px;
        }
        .idx-footer-btn {
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
        .idx-footer-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

        /* ── MAIN AREA ── */
        .idx-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          padding: 40px;
          gap: 48px;
        }

        .idx-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 14px;
        }
        .idx-hero-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: var(--accent-teal-bg);
          border: 1px solid rgba(29,184,147,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }
        .idx-hero-title {
          font-size: 26px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }
        .idx-hero-sub {
          font-size: 14px;
          color: var(--text-muted);
          max-width: 340px;
          line-height: 1.6;
        }

        /* Upload card */
        .idx-upload-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          width: 100%;
          max-width: 380px;
        }

        .idx-upload-zone {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          border: 1.5px dashed var(--border);
          border-radius: 14px;
          padding: 40px 32px;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          text-align: center;
          background: var(--bg-secondary);
        }
        .idx-upload-zone:hover {
          border-color: var(--accent-teal);
          background: var(--accent-teal-bg);
        }
        .idx-upload-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }
        .idx-upload-label {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .idx-upload-sub {
          font-size: 12px;
          color: var(--text-muted);
        }
        .idx-upload-badge {
          font-size: 11px;
          padding: 3px 10px;
          border-radius: 20px;
          background: var(--accent-teal-bg);
          color: var(--accent-teal);
          font-weight: 500;
          animation: idxPulse 1.5s ease-in-out infinite;
        }
        @keyframes idxPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

        /* Loading state */
        .idx-loading {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          color: var(--text-muted);
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .idx-spinner {
          width: 24px;
          height: 24px;
          border: 2.5px solid var(--border);
          border-top-color: var(--accent-teal);
          border-radius: 50%;
          animation: idxSpin 0.75s linear infinite;
          margin-right: 10px;
        }
        @keyframes idxSpin { to { transform: rotate(360deg); } }

        * { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
      `}</style>

      {loading ? (
        <div className={`idx-loading index-shell ${isDark ? 'dark' : 'light'}`}>
          <div className="idx-spinner" />
          Loading chats...
        </div>
      ) : (
        <div className={`index-shell ${isDark ? 'dark' : 'light'}`}>

          {/* ── SIDEBAR ── */}
          <div className="idx-sidebar">
            <div className="idx-sidebar-header">
              <span className="idx-sidebar-title">History</span>
              <button
                className="idx-theme-btn"
                onClick={() => setIsDark(d => !d)}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>

            {/* New PDF Chat */}
            <label className="idx-new-btn">
              <Plus size={14} />
              New PDF Chat
              <input type="file" accept=".pdf,application/pdf" hidden onChange={(e) => uploadPDF(e.target.files?.[0])} />
            </label>

            {chats.length > 0 && (
              <div className="idx-section-label">Recent</div>
            )}

            <div className="idx-chat-scroll">
              {chats.length === 0 ? (
                <div className="idx-empty-chats">No conversations yet</div>
              ) : (
                chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => openChat(chat.id)}
                    className="idx-chat-item"
                  >
                    <MessageSquare size={13} />
                    <div className="idx-chat-item-inner">
                      <div className="idx-chat-name">{truncateTitle(chat.title)}</div>
                      <div className="idx-chat-date">
                        {new Date(chat.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="idx-sidebar-footer">
              <button className="idx-footer-btn">
                <Settings size={14} />
                Settings
              </button>
              <button className="idx-footer-btn">
                <ExternalLink size={14} />
                Upgrade Plan
              </button>
            </div>
          </div>

          {/* ── MAIN AREA ── */}
          <div className="idx-main">
            <div className="idx-hero">
              <div className="idx-hero-icon">
                <FileText size={28} color="var(--accent-teal)" />
              </div>
              <div className="idx-hero-title">Chat with PDF</div>
              <div className="idx-hero-sub">
                Upload a PDF document and start asking questions about its contents instantly.
              </div>
            </div>

            <div className="idx-upload-card">
              {uploading ? (
                <span className="idx-upload-badge">Uploading your PDF...</span>
              ) : (
                <label style={{ width: '100%', cursor: 'pointer' }}>
                  <div className="idx-upload-zone">
                    <div className="idx-upload-icon">
                      <Upload size={22} color="var(--text-muted)" />
                    </div>
                    <div className="idx-upload-label">Upload a PDF</div>
                    <div className="idx-upload-sub">Click to select · PDF files only</div>
                  </div>
                  <input
                    type="file"
                    accept="application/pdf"
                    hidden
                    onChange={(e) => uploadPDF(e.target.files[0])}
                  />
                </label>
              )}
            </div>
          </div>

        </div>
      )}
    </>
  );
}