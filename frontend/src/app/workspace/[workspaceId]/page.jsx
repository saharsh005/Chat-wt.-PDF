'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function WorkspaceRedirect() {
  const { workspaceId } = useParams();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isLoaded && workspaceId) {
      handleRedirect();
    }
  }, [isLoaded, workspaceId]);

  async function handleRedirect() {
    try {
      const token = await getToken();
      const hdr = { Authorization: `Bearer ${token}` };

      // 1. Fetch existing chats
      const chatRes = await fetch(`${API}/workspace/${workspaceId}/chats`, { headers: hdr });
      const chats = await chatRes.json();

      if (Array.isArray(chats) && chats.length > 0) {
        // Redirect to the most recent chat
        router.replace(`/workspace/${workspaceId}/chat/${chats[0].id}`);
      } else {
        // 2. Create a new chat if none exists
        const createRes = await fetch(`${API}/chat/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ workspaceId }),
        });
        const newChat = await createRes.json();
        router.replace(`/workspace/${workspaceId}/chat/${newChat.id}`);
      }
    } catch (err) {
      console.error('Redirection error:', err);
      setError('Failed to load workspace. Please try again.');
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#080808',
      color: '#e2e2e2',
      fontFamily: "'Inter', -apple-system, sans-serif"
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
      
      {error ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#e85d5d', marginBottom: '16px' }}>{error}</div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: '#111',
              border: '1px solid #333',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <Loader2 size={32} className="spin" style={{ color: '#6495ed', marginBottom: '16px' }} />
          <div style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '0.02em', color: '#888' }}>
            Preparing your research workspace…
          </div>
        </>
      )}
    </div>
  );
}
