"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

const API_BASE = "http://localhost:5000";

export default function ChatIndexPage() {
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
    formData.append('pdf', file);   // MUST match upload.single("pdf")

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
  };33332

  if (loading) {
    return (
      <div className="p-6 text-gray-500">
        Loading chats...
      </div>
    );
  }

  return (
    <div className="flex h-full">
      
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Your Chats</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Upload New PDF
          </label>

          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => uploadPDF(e.target.files[0])}
            className="w-full text-sm"
          />
        </div>

        {chats.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No chats yet. Upload a PDF to start.
          </p>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => openChat(chat.id)}
                className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="font-medium truncate">
                  {chat.title || "Untitled Chat"}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(chat.created_at).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty State */}
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">
            Select a chat
          </h3>
          <p className="text-sm">
            Choose a conversation from the left to continue.
          </p>
        </div>
      </div>

    </div>
  );
}
