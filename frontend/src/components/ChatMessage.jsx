import { Sprout } from 'lucide-react';

// Markdown พื้นฐานที่แสดงผลด้วย React node (ไม่ใช้ innerHTML จึง escape ข้อความโดยอัตโนมัติ)
function renderInline(value) {
  return String(value).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={idx}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={idx}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function MessageBody({ content }) {
  const lines = String(content).split('\n');
  const chunks = [];
  let list = [];
  function flush() {
    if (list.length) { chunks.push({ type: 'list', items: list }); list = []; }
  }
  for (const line of lines) {
    const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (item) list.push(item[1]);
    else { flush(); if (line.trim()) chunks.push({ type: 'paragraph', text: line.replace(/^#+\s*/, '') }); }
  }
  flush();
  return chunks.map((chunk, i) => chunk.type === 'list'
    ? <ul key={i}>{chunk.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ul>
    : <p key={i}>{renderInline(chunk.text)}</p>);
}

export function AiAvatar({ online = false }) {
  return <span className={`ai-av ${online ? 'is-online' : ''}`} aria-hidden="true"><Sprout /></span>;
}

export default function ChatMessage({ message }) {
  return message.role === 'user'
    ? <div className="m u"><div className="b">{message.content}</div></div>
    : <div className="m a"><AiAvatar /><div className="b"><MessageBody content={message.content} /></div></div>;
}
