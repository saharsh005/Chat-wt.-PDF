'use client';
import { useUser, useClerk, useAuth  } from '@clerk/nextjs';
import { useState, useEffect, useRef } from 'react';
//import { createClient } from '@supabase/supabase-js';
import { Upload, Send, History, BookOpen } from 'lucide-react';


// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
// );

export default function ChatPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pdfId, setPdfId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const messagesEndRef = useRef(null);

    const { getToken } = useAuth();

useEffect(() => {
  if (!isLoaded || !getToken) return;  // ✅ Add getToken check

  const loadChats = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`http://localhost:3000/chat`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        console.error("Failed to load chats:", res.status);
        return;
      }

      const data = await res.json();
      setChats(data || []);  // ✅ Handle empty response
    } catch (err) {
      console.error("Load chats error:", err);
    }
  };

  loadChats();
}, [isLoaded]);  // ✅ Remove getToken from deps - causes infinite loop


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // useEffect(() => {
  //   const loadChats = async () => {
  //     const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat`, {
  //       headers: {
  //         Authorization: `Bearer ${await getToken()}`
  //       }
  //     });

  //     setChats(await res.json());
  //   };

  //   loadChats();
  // }, [getToken]);


  // useEffect(() => {
  //   if (!isLoaded || !isSignedIn) return;
  //   loadChats();
  // }, [isLoaded, isSignedIn]);


  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // const loadChats = async () => {
  // if (!user?.id) return;

  // const { data, error } = await supabase
  //   .from('chats')
  //   .select('id, title, created_at')
  //   .eq('user_id', user.id)
  //   .order('created_at', { ascending: false });

  //   if (!error) setChats(data || []);
  // };


  const uploadPDF = async (file) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/upload`, {
      method: 'POST',
      body: formData,
      headers: { Authorization: `Bearer ${await getToken()}` }
    });

    const data = await res.json();
    console.log("UPLOAD RESPONSE:", data);

    const pdfId = data.pdfId || data.id; // <-- IMPORTANT
    setPdfId(pdfId);
    //setUploading(false);
      };

  const sendMessage = async () => {
    if (!input.trim() || !pdfId) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getToken()}`
        },
        body: JSON.stringify({ pdfId, question: userMessage })
      });

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', content: 'Error sending message' }]);
    }
  };



  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-8">
          <BookOpen className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">PDF Chat</h1>
        </div>

        {/* Upload */}
        <div className="mb-8 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 transition-colors">
          <label className="cursor-pointer">
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2 block" />
            <p className="text-sm text-gray-600">Drop PDF or click to upload</p>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => uploadPDF(e.target.files[0])}
              className="hidden"
            />
          </label>
          {uploading && <p className="text-blue-600 mt-2">Uploading...</p>}
          {pdfId && <p className="text-green-600 mt-2 text-sm">✅ {pdfId.slice(0, 8)}...</p>}
        </div>

        {/* Chat History */}
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <History className="w-4 h-4" />
            Your Chats
          </h3>
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors flex items-start gap-3"
            >
              <div className="flex-1">
                <p className="font-medium truncate">{chat.title}</p>
                <p className="text-xs text-gray-500">{new Date(chat.created_at).toLocaleDateString()}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-gray-200 p-4 bg-white flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {pdfId ? `PDF Chat (${pdfId.slice(0, 12)}...)` : 'Select a PDF to start'}
          </h2>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            {messages.filter(m => m.role === 'assistant').length} replies
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-2xl p-4 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : msg.role === 'assistant' 
                    ? 'bg-gradient-to-r from-gray-50 to-gray-100 border' 
                    : 'bg-red-100 border-red-300 text-red-800'
              }`}>
                <p>{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-200 p-6 bg-white">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={pdfId ? "Ask about this PDF..." : "Upload PDF first"}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              disabled={!pdfId}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !pdfId}
              className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          {!pdfId && <p className="text-sm text-gray-500 mt-2 text-center">Upload a PDF to start chatting</p>}
        </div>
      </div>
    </div>
  );
}
