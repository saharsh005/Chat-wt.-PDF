'use client';

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function WorkspaceList() {
  const { getToken } = useAuth();
  const router = useRouter();
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  const [workspaces, setWorkspaces] = useState([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/workspace`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setWorkspaces(data || []);
  };

  const createWorkspace = async () => {
    if (!title.trim()) return;

    const token = await getToken();
    const res = await fetch(`${API_BASE}/workspace`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ title })
    });

    const data = await res.json();
    router.push(`/workspace/${data.id}`);
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Your Workspaces</h2>

      <div style={{ marginTop: 20 }}>
        <input
          placeholder="New workspace title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button onClick={createWorkspace}>Create</button>
      </div>

      <ul style={{ marginTop: 30 }}>
        {workspaces.map(ws => (
          <li key={ws.id}>
            <button onClick={() => router.push(`/workspace/${ws.id}`)}>
              {ws.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
