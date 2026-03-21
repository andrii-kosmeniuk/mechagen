import React, { useState } from 'react';

const WELCOME =
  "Hello! I'm your mechanical engineering co-pilot. How can I help you design today?";

export function ChatPanel() {
  const [messages, setMessages] = useState<string[]>([WELCOME]);
  const [input, setInput] = useState('');

  return (
    <aside className="ai-chat-panel" id="chat-panel">
      <div className="chat-header flex-between">
        <span className="chat-title">AI Co-Pilot</span>
        <button
          type="button"
          className="chat-close"
          aria-label="Close chat"
        >
          ×
        </button>
      </div>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className="card chat-bubble">
            {m}
          </div>
        ))}
      </div>
      <div className="chat-input-row">
        <div className="flex-between gap-2">
          <input
            type="text"
            className="chat-input"
            placeholder="Ask AI..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim()) {
                setMessages((m) => [...m, input.trim()]);
                setInput('');
              }
            }}
          />
          <button
            type="button"
            className="btn-primary chat-send"
            onClick={() => {
              if (!input.trim()) return;
              setMessages((m) => [...m, input.trim()]);
              setInput('');
            }}
          >
            Send
          </button>
        </div>
      </div>
    </aside>
  );
}
