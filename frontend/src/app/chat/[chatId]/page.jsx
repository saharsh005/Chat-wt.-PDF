'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Send, History, ChevronLeft, X, MessageSquare, FileText, Plus } from 'lucide-react';
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
      console.log('🔍 Loading chats from:', 'http://localhost:5000/chat'); // DEBUG
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

      // 1. Fetch chat metadata (controls pdfId, title, etc.)
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

      // 2. Fetch messages for this specific chat
      console.log('🔍 Loading messages:', `${API_BASE}/chat/${chatId}/messages`);
      const msgRes = await fetch(`http://localhost:5000/chat/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const messagesData = await msgRes.json();
      setMessages(messagesData || []);

    } catch (err) {
      console.error("Failed to load chat:", err);
      // Clear invalid state
      setChatData(null);
      setPdfId(null);
      setMessages([]);
      // Redirect to home on error
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
      // No chatId in URL = clear everything
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
    formData.append('file', file);

    try {
      const token = await getToken();
      
      // 1. Upload PDF
      const uploadRes = await fetch(`http://localhost:5000/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();

      // 2. Create new chat (URL will take over after push)
      const chatRes = await fetch(`http://localhost:5000/chat/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pdfId: uploadData.pdfId })
      });

      if (!chatRes.ok) throw new Error('Chat creation failed');
      
      const newChat = await chatRes.json();
      
      // 3. Navigate to new chat URL - this triggers loadChatFromUrl automatically
      router.push(`/chat/${newChat.id}`);

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
          chatId: routeChatId, // Always use URL chatId
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
      // Revert user message
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
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* CHAT HISTORY SIDEBAR */}
      <div className={`h-full bg-gray-900 transition-all duration-300 ease-in-out ${
        isHistoryOpen ? 'w-1/5 min-w-[260px]' : 'w-0'
      } overflow-hidden flex flex-col`}>
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <button onClick={() => setIsHistoryOpen(false)} className="p-1.5 hover:bg-gray-800 rounded-md">
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <span className="text-gray-200 font-medium">Chat History</span>
            <button className="p-1.5 hover:bg-gray-800 rounded-md">
              <Plus className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => selectChat(chat)}
              className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                chatData?.id === chat.id ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{truncateTitle(chat.title)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(chat.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            </button>
          ))}
          {chats.length === 0 && (
            <div className="text-center py-8 px-4">
              <MessageSquare className="mx-auto w-8 h-8 text-gray-700 mb-3" />
              <p className="text-gray-400 text-sm">No conversation history</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-800">
          <label className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors cursor-pointer mb-3">
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">Upload PDF</span>
            <input type="file" accept=".pdf" hidden onChange={(e) => uploadPDF(e.target.files?.[0])} />
          </label>
          <div className="flex items-center gap-3 px-3 py-2 text-gray-400 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              Online
            </div>
            <div className="text-gray-600">•</div>
            <div>{chats.length} chats</div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className={`h-full transition-all duration-300 ease-in-out ${
        isHistoryOpen ? 'w-4/5' : 'w-full'
      } flex`}>
        {/* PDF SECTION */}
        <div className={`h-full bg-white border-r border-gray-200 ${
          isHistoryOpen ? 'w-2/5' : 'w-1/2'
        } transition-all duration-300 flex flex-col`}>
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-700" />
              <div>
                <h2 className="font-medium text-gray-900">Document</h2>
                {pdfId && <p className="text-xs text-gray-500">ID: {pdfId.slice(0, 12)}...</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isHistoryOpen && (
                <button onClick={() => setIsHistoryOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <History className="w-4 h-4 text-gray-600" />
                </button>
              )}
              {pdfId && (
                <button onClick={goHome} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {pdfId ? (
              <PdfViewer pdfId={pdfId} page={currentPage} />
            ) : (
              <div className="h-full flex items-center justify-center p-12">
                <div className="text-center max-w-md">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload Document</h3>
                  <p className="text-gray-600 mb-8">Upload PDF to start chatting</p>
                  <label className="block w-full max-w-sm mx-auto">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-blue-400 transition-all cursor-pointer">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-lg font-medium text-gray-900">Click to upload PDF</p>
                    </div>
                    <input type="file" accept=".pdf" hidden onChange={(e) => uploadPDF(e.target.files?.[0])} />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CHAT SECTION */}
        <div className={`h-full bg-gray-50 flex flex-col ${
          isHistoryOpen ? 'w-3/5' : 'w-1/2'
        }`}>
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-gray-900">
                    {chatData ? truncateTitle(chatData.title) : 'New Chat'}
                  </h1>
                  <p className="text-sm text-gray-500">
                    {pdfId ? `Document: ${pdfId.slice(0, 8)}...` : 'Upload to start'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {uploading && (
                  <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm animate-pulse">
                    Uploading...
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {loadingMessages ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-gray-200 rounded-full relative">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute"></div>
                </div>
                <p className="mt-4 text-gray-600">Loading chat...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="w-8 h-8 text-gray-500" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">
                  {pdfId ? 'Ready to chat!' : 'Select a chat or upload'}
                </h2>
                <p className="text-gray-600 max-w-md">
                  {pdfId ? 'Ask questions about your document' : 'Choose from history or upload a new PDF'}
                </p>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-6">
                {messages.map((message, index) => (
                  <div key={index} className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.role === 'user' ? 'bg-blue-600' : 'bg-gray-800'
                    }`}>
                      {message.role === 'user' ? 'U' : <MessageSquare className="w-4 h-4 text-white" />}
                    </div>
                    <div className={`max-w-[70%] ${message.role === 'user' ? 'order-first' : ''}`}>
                      <div className={`px-4 py-3 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white ml-auto'
                          : 'bg-white border shadow-sm'
                      }`}>
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      </div>
                      <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-blue-100 text-right' : 'text-gray-500'}`}>
                        {message.role === 'user' ? 'You' : 'AI'}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white p-4">
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={pdfId ? "Ask about the document..." : "Select chat first"}
                  disabled={!pdfId || !routeChatId || uploading}
                  className="w-full px-4 py-3 pr-12 resize-none rounded-xl border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
                  rows="2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || !pdfId || !routeChatId || uploading}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
                    input.trim() && pdfId && routeChatId && !uploading
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                <span>{routeChatId ? `Chat: ${routeChatId.slice(0, 8)}...` : 'No chat selected'}</span>
                {!isHistoryOpen && (
                  <button onClick={() => setIsHistoryOpen(true)} className="flex items-center gap-1 hover:text-gray-900">
                    <History className="w-4 h-4" />
                    History
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}