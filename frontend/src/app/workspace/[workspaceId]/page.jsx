'use client';

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Plus, MessageSquare, Upload, FileText } from 'lucide-react';

export default function WorkspaceDashboard() {
  const { workspaceId } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  const [pdfs, setPdfs] = useState([]);
  const [chats, setChats] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedPdfs, setSelectedPdfs] = useState([]);

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const loadData = async () => {
    if (!workspaceId) return;
    const token = await getToken();

    try {
      const [pdfRes, chatRes] = await Promise.all([
        fetch(`${API_BASE}/workspace/${workspaceId}/pdfs`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/workspace/${workspaceId}/chats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setPdfs(await pdfRes.json());
      setChats(await chatRes.json());
    } catch (err) {
      console.error('Load data failed:', err);
    }
  };

  const uploadPDFs = async (files) => {
    if (!files?.length || !workspaceId) return;
    
    setUploading(true);
    const token = await getToken();

    try {
      // Upload each PDF
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("pdf", file);
        formData.append("workspaceId", workspaceId); // ✅ CRITICAL: workspaceId

        const res = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        if (!res.ok) throw new Error(`Upload failed: ${file.name}`);
      }
      
      await loadData(); // Refresh lists
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  const createChat = async () => {
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
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      background: '#1a1a1a',
      color: '#e8e8e8',
      padding: '20px',
      gap: '24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Workspace</h2>
        <button 
          onClick={createChat}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 16px', background: '#2a2a2a', 
            border: '1px solid #383838', borderRadius: '8px',
            color: '#e8e8e8', cursor: 'pointer'
          }}
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      {/* Multiple PDF Upload */}
      <div>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <div style={{
            padding: '24px', border: '2px dashed #383838', 
            borderRadius: '12px', textAlign: 'center',
            background: uploading ? '#2a2a2a' : 'transparent',
            transition: 'all 0.2s'
          }}>
            <Upload size={32} style={{ margin: '0 auto 12px', color: '#666', display: 'block' }} />
            <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
              {uploading ? 'Uploading...' : 'Upload PDFs (Multiple)'}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Click or drag {selectedPdfs.length ? `(${selectedPdfs.length} selected)` : ''}
            </div>
          </div>
          <input 
            type="file" 
            multiple 
            accept=".pdf" 
            hidden 
            onChange={(e) => {
              const files = Array.from(e.target.files);
              setSelectedPdfs(files.map(f => f.name));
              uploadPDFs(e.target.files);
            }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1 }}>
        {/* PDFs Section */}
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>PDFs ({pdfs.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflow: 'auto' }}>
            {pdfs.length ? pdfs.map(pdf => (
              <div key={pdf.pdf_id} style={{
                padding: '12px', background: '#222', borderRadius: '8px',
                display: 'flex', alignItems: 'center', gap: '12px'
              }}>
                <FileText size={16} />
                <span style={{ flex: 1, fontSize: '13px' }}>{pdf.filename}</span>
              </div>
            )) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No PDFs uploaded
              </div>
            )}
          </div>
        </div>

        {/* Chats Section */}
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Chats ({chats.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflow: 'auto' }}>
            {chats.length ? chats.map(chat => (
              <button 
                key={chat.id}
                onClick={() => router.push(`/workspace/${workspaceId}/chat/${chat.id}`)}
                style={{
                  width: '100%', padding: '12px', background: '#222', 
                  border: '1px solid #383838', borderRadius: '8px',
                  textAlign: 'left', cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseOver={(e) => e.target.style.background = '#333'}
                onMouseOut={(e) => e.target.style.background = '#222'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <MessageSquare size={16} style={{ color: '#666' }} />
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>
                    {chat.title || "Untitled Chat"}
                  </span>
                </div>
              </button>
            )) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                No chats created
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
