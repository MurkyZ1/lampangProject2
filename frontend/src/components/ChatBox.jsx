import { useEffect, useRef, useState } from 'react';
import ChatMessage from './ChatMessage';
import { ArrowUp, Sparkles, X } from 'lucide-react';
import { isDemoChat } from '../services/chatService';
import { AiAvatar } from './ChatMessage';

const SUGGESTIONS = [
  ['ดินแบบไหนเหมาะกับลำไย', 'อำเภอไหนในลำปางเหมาะปลูกลำไยที่สุด'],
  ['ปลูกอะไรดีหน้าแล้ง', 'ช่วงฤดูแล้งในลำปางควรปลูกพืชอะไร'],
  ['ปรับปรุงดินลูกรัง', 'ดินลูกรังความอุดมสมบูรณ์ต่ำ ควรปรับปรุงอย่างไร'],
  ['กาแฟบนที่สูง', 'อยากปลูกกาแฟในลำปาง ควรเลือกอำเภอไหนและเริ่มอย่างไร'],
];

export default function ChatBox({ popup = false, open = false, onClose, selected, districts, onSelect, history, busy, onSend }) {
  const [draft, setDraft] = useState('');
  const scroller = useRef(null);
  const areaRef = useRef(null);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [history, busy, open]);
  useEffect(() => {
    if (popup && open) areaRef.current?.focus({ preventScroll: true });
  }, [popup, open]);

  const submit = (event) => {
    event?.preventDefault();
    if (!draft.trim() || busy) return;
    onSend(draft.trim());
    setDraft('');
    if (areaRef.current) areaRef.current.style.height = 'auto';
  };

  return (
    <div className={popup ? `pop ${open ? 'open' : ''}` : 'chat-shell'} role={popup ? 'dialog' : undefined} aria-label="หน้าต่างแชตให้คำแนะนำ" {...(popup ? { 'aria-hidden': !open, inert: !open } : {})}>
      <div className="chat-bar">
        <div className="who"><AiAvatar online /><div>
          <b>ผู้ช่วยเกษตรลำปาง</b>
          <small>{isDemoChat ? 'DEMO · ยังไม่เชื่อมต่อ AI จริง' : 'AI · ตอบเรื่องดิน อากาศ และการปลูก'}</small>
        </div></div>
        {popup ? <button className="x" onClick={onClose} aria-label="ปิดแชต">
          <X aria-hidden="true" />
        </button> : <label className="ctx">พื้นที่
          <select value={selected || ''} onChange={(e) => onSelect(e.target.value || null)}>
            <option value="">ทั้งจังหวัด</option>
            {districts.map((d) => <option key={d.code} value={d.code}>{d.th}</option>)}
          </select>
        </label>}
      </div>
      <div className="msgs" ref={scroller}>
        <div className="msgs-in">
          {!history.length && !busy ? <div className="welcome">
            <span className="welcome-icon" aria-hidden="true"><Sparkles /></span>
            <h3>วันนี้อยากปลูกอะไรดี?</h3>
            <p>ถามเรื่องสภาพดิน อากาศ หรือวิธีปลูกในแต่ละอำเภอของลำปาง</p>
            <div className="sugs">{SUGGESTIONS.map(([title, prompt], i) => <button type="button" style={{ '--i': i }} className="sug" key={title} disabled={busy} onClick={() => onSend(prompt)}>
              <b>{title}</b><span>{prompt}</span>
            </button>)}</div>
          </div> : <>
            {history.map((msg) => <ChatMessage key={msg.id} message={msg} />)}
            {busy && <div className="m a" role="status" aria-label="ผู้ช่วยกำลังพิมพ์"><AiAvatar /><div className="b"><span className="typing"><i /><i /><i /></span></div></div>}
          </>}
        </div>
      </div>
      <form className="composer" onSubmit={submit}>
        <div className="comp">
          <textarea
            ref={areaRef}
            rows={1}
            value={draft}
            aria-label="ข้อความที่จะส่ง"
            placeholder="ถามเรื่องดิน อากาศ หรือพืชที่ควรปลูก…"
            onChange={(e) => { setDraft(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
          />
          <button className="send" type="submit" disabled={!draft.trim() || busy} aria-label="ส่งข้อความ">
            <ArrowUp aria-hidden="true" />
          </button>
        </div>
        <p className="disc">{isDemoChat ? 'ตัวอย่างการตอบจากข้อมูลเดิม ยังไม่ใช่ AI จริง' : 'คำตอบจาก AI เป็นแนวทางเบื้องต้น ควรตรวจสอบกับเจ้าหน้าที่เกษตรในพื้นที่'}</p>
      </form>
    </div>
  );
}
