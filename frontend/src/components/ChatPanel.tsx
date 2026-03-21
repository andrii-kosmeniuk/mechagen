import React, { useRef, useState } from 'react';

const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';
const WELCOME =
  "Hello! I'm your mechanical engineering co-pilot. How can I help you design today?";

type Msg = { role: 'ai' | 'user'; text: string };

export function ChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([{ role: 'ai', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await fetch(API_BASE + '/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json() as { reply?: string };
      setMessages((m) => [...m, { role: 'ai', text: data.reply || 'No response.' }]);
    } catch {
      setMessages((m) => [...m, { role: 'ai', text: 'Error reaching AI. Is the backend running?' }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  return (
    <aside className="ai-chat-panel" id="chat-panel">
      <div className="chat-header flex-between">
        <span className="chat-title">AI Co-Pilot</span>
        <button type="button" className="chat-close" aria-label="Close chat">×</button>
      </div>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`card chat-bubble ${m.role === 'user' ? 'chat-bubble-user' : ''}`}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="card chat-bubble">
            <span className="chat-typing"><span>●</span><span>●</span><span>●</span></span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <div className="flex-between gap-2">
          <input
            type="text"
            className="chat-input"
            placeholder="Ask AI..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            disabled={loading}
          />
          <button
            type="button"
            className="btn-primary chat-send"
            onClick={send}
            disabled={loading}
          >
            Send
          </button>
        </div>
      </div>
    </aside>
  );
}
