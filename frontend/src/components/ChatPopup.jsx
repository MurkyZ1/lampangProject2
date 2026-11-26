import { useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import ChatBox from './ChatBox';

export default function ChatPopup({ open, onOpen, onClose, ...props }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return <>
    <button type="button" className={`fab ${open ? 'hide' : ''}`} onClick={onOpen} aria-label="เปิดแชตปรึกษาการปลูก" aria-expanded={open}>
      <span className="fab-icon" aria-hidden="true"><MessageCircle /></span><span className="fab-label">ถาม AI เรื่องการปลูก</span>
    </button>
    <ChatBox popup open={open} onClose={onClose} {...props} />
  </>;
}
