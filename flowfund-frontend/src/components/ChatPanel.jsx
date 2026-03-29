import { useState, useRef, useEffect } from 'react';
import { sendMessage } from '../api/chat';

const SUGGESTED_PROMPTS = [
  'How am I spending my money?',
  'What should I focus on to save more?',
  'What recurring charges do I have?',
  'Where are my biggest expenses?',
  'How can I improve my financial health?',
];

const styles = {
  container: {
    border: '1px solid #e8ecea',
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    height: '480px',
    marginTop: '24px',
  },
  header: {
    padding: '14px 20px',
    background: '#1a4d3e',
    color: '#fff',
    fontWeight: 700,
    fontSize: '15px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  badge: {
    fontSize: '11px',
    fontWeight: 500,
    background: 'rgba(255,255,255,0.2)',
    padding: '2px 8px',
    borderRadius: '20px',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  messageUser: {
    alignSelf: 'flex-end',
    background: '#1a4d3e',
    color: '#fff',
    borderRadius: '12px 12px 2px 12px',
    padding: '10px 14px',
    maxWidth: '75%',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  messageBot: {
    alignSelf: 'flex-start',
    background: '#f4f7f5',
    color: '#0f2d25',
    borderRadius: '12px 12px 12px 2px',
    padding: '10px 14px',
    maxWidth: '85%',
    fontSize: '14px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
  },
  messageLoading: {
    alignSelf: 'flex-start',
    background: '#f4f7f5',
    color: '#888',
    borderRadius: '12px',
    padding: '10px 14px',
    fontSize: '13px',
    fontStyle: 'italic',
  },
  suggestions: {
    padding: '8px 16px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    borderTop: '1px solid #f0f0f0',
  },
  suggestionBtn: {
    fontSize: '12px',
    padding: '4px 10px',
    border: '1px solid #c4d8d0',
    borderRadius: '20px',
    background: '#fff',
    color: '#1a4d3e',
    cursor: 'pointer',
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid #e8ecea',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    border: '1px solid #d0dbd7',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
  },
  sendBtn: {
    padding: '10px 18px',
    background: '#1a4d3e',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  disclaimer: {
    fontSize: '11px',
    color: '#999',
    padding: '0 16px 8px',
    textAlign: 'center',
  },
};

export default function ChatPanel({ hasLinkedAccounts }) {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: hasLinkedAccounts
        ? "Hi! I'm your FlowFund AI financial assistant. I can see your linked account data. Ask me anything about your spending, savings, or financial habits."
        : "Hi! I'm your FlowFund AI financial assistant. Connect a bank account first so I can give you personalized insights based on your real spending data.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: msg }]);
    setLoading(true);

    try {
      const { data } = await sendMessage(msg);
      setMessages((prev) => [...prev, { role: 'bot', text: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: 'Sorry, I was unable to generate a response. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        FlowFund AI Assistant
        <span style={styles.badge}>Educational only</span>
      </div>

      <div style={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === 'user' ? styles.messageUser : styles.messageBot}>
            {m.text}
          </div>
        ))}
        {loading && <div style={styles.messageLoading}>Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div style={styles.suggestions}>
          {SUGGESTED_PROMPTS.map((p) => (
            <button key={p} style={styles.suggestionBtn} onClick={() => handleSend(p)}>
              {p}
            </button>
          ))}
        </div>
      )}

      <p style={styles.disclaimer}>
        Educational guidance only — not financial advice. FlowFund AI is not a licensed advisor.
      </p>

      <div style={styles.inputRow}>
        <input
          style={styles.input}
          placeholder="Ask about your spending or savings..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={loading}
        />
        <button style={styles.sendBtn} onClick={() => handleSend()} disabled={loading}>
          Send
        </button>
      </div>
    </div>
  );
}
