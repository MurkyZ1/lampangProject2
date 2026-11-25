import ChatBox from './ChatBox';

export default function ChatPopup({ open, onOpen, onClose, ...props }) {
  return <>
    <button className={`fab ${open ? 'hide' : ''}`} onClick={onOpen} aria-label="เปิดแชตปรึกษาการปลูก" aria-expanded={open}>
      <span className="ai-av" aria-hidden="true" />ถาม AI เรื่องการปลูก
    </button>
    <ChatBox popup open={open} onClose={onClose} {...props} />
  </>;
}
