'use client';

import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function ChatPage() {
  const { workspaceId, chatId } = useParams();
  const { getToken } = useAuth();
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/chat/${chatId}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setMessages(await res.json());
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const text = input;
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");

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
        question: text
      })
    });

    const data = await res.json();

    setMessages(prev => [
      ...prev,
      { role: "assistant", content: data.answer }
    ]);
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Workspace Research Chat</h2>

      <div style={{ marginTop: 20 }}>
        {messages.map((m, i) => (
          <div key={i}>
            <strong>{m.role}:</strong> {m.content}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
