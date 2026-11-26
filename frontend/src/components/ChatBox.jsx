import { useEffect, useRef, useState } from 'react';
import ChatMessage from './ChatMessage';
import { isDemoChat } from '../services/chatService';
import { loadTambonNames } from '../services/modelService';

// พืชทั้ง 10 ชนิดของโมเดล (ชื่อตรงกับ backend)
const CROP_NAMES = ['ข้าวนาปี', 'ข้าวโพดเลี้ยงสัตว์', 'มันสำปะหลัง', 'มะม่วง', 'สับปะรด', 'กระเทียม', 'ถั่วเหลือง', 'ลำไย', 'อ้อยโรงงาน', 'กาแฟอาราบิกา'];

// ปุ่มคำถาม: สร้างข้อความจากอำเภอ/ตำบล/พืชที่เลือก (needs = ต้องเลือกอะไรก่อน)
const QUESTIONS = [
  { key: 'plant', label: 'ปลูกอะไรดี', needs: [],
    text: ({ a, t }) => (t ? `ตำบล${t} อำเภอ${a} ปลูกพืชอะไรดี` : a ? `อำเภอ${a} ปลูกพืชอะไรดี` : 'ทั้งจังหวัดลำปาง พืชอะไรเหมาะที่สุด') },
  { key: 'soil', label: 'ดินและฝน', needs: ['อำเภอ'], text: ({ a }) => `ดินและฝนที่อำเภอ${a}เป็นอย่างไร` },
  { key: 'where', label: 'พืชนี้เหมาะที่ไหน', needs: ['พืช'], text: ({ c }) => `${c}เหมาะกับอำเภอไหนมากที่สุด` },
  { key: 'fit', label: 'พืชนี้ในพื้นที่ฉัน', needs: ['อำเภอ', 'พืช'], text: ({ a, t, c }) => `${c}เหมาะกับ${t ? `ตำบล${t} อำเภอ${a}` : `อำเภอ${a}`}แค่ไหน` },
  { key: 'all', label: 'ภาพรวมทั้งจังหวัด', needs: [], text: () => 'ทั้งจังหวัดลำปาง พืชอะไรเหมาะที่สุด' },
  { key: 'limit', label: 'ลำไย อ้อย กาแฟ', needs: [], text: () => 'ทำไมลำไย อ้อย กาแฟ ถึงไม่มีพื้นที่ผ่านเกณฑ์' },
  { key: 'trust', label: 'เชื่อถือได้แค่ไหน', needs: [], text: () => 'ผลจากระบบนี้เชื่อถือได้แค่ไหน' },
];

export default function ChatBox({ popup = false, open = false, onClose, selected, districts, onSelect, history, busy, onSend }) {
  const [draft, setDraft] = useState('');
  const scroller = useRef(null);
  const areaRef = useRef(null);
  const [tambon, setTambon] = useState('');
  const [crop, setCrop] = useState('');
  const [tambonList, setTambonList] = useState([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const district = districts.find((d) => d.code === selected);
  const amphoe = district?.th || '';

  // เปลี่ยนอำเภอ → ล้างตำบลที่เลือก แล้วโหลดรายชื่อตำบลของอำเภอนั้น
  useEffect(() => {
    setTambon('');
    setTambonList([]);
    if (!amphoe) return undefined;
    let alive = true;
    loadTambonNames(amphoe).then((list) => { if (alive) setTambonList(list); }).catch(() => { if (alive) setTambonList([]); });
    return () => { alive = false; };
  }, [amphoe]);

  const pick = { a: amphoe, t: tambon, c: crop };
  const missing = (q) => q.needs.filter((n) => (n === 'อำเภอ' ? !amphoe : !crop));
  const ask = (q) => { if (!busy && !missing(q).length) onSend(q.text(pick)); };

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
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
    <div className={popup ? `pop ${open ? 'open' : ''}` : 'chat-shell'} aria-label="หน้าต่างแชตให้คำแนะนำ" {...(popup ? { 'aria-hidden': !open } : {})}>
      <div className="chat-bar">
        <div className="who"><span className="ai-av" aria-hidden="true" /><div>
          <b>ผู้ช่วยเกษตรลำปาง</b>
          <small>{isDemoChat ? 'DEMO · ยังไม่เชื่อมต่อ AI จริง' : 'AI · ตอบเรื่องดิน อากาศ และการปลูก'}</small>
        </div></div>
        {popup ? <button className="x" onClick={onClose} aria-label="ปิดแชต">
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" /></svg>
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
            <h3>วันนี้อยากปลูกอะไรดี?</h3>
            <p>ถามเรื่องดิน ฝน และพืชที่เหมาะในแต่ละอำเภอของลำปาง</p>
            <p className="welcome-hint">เลือกอำเภอ ตำบล หรือพืช แล้วกดคำถามด้านล่างได้เลย</p>
          </div> : <>
            {history.map((msg) => <ChatMessage key={msg.id} message={msg} />)}
            {busy && <div className="m a"><span className="ai-av" aria-hidden="true" /><div className="b"><span className="typing"><i /><i /><i /></span></div></div>}
          </>}
        </div>
      </div>
      <div className="quick">
        <button type="button" className="quick-toggle" onClick={() => setQuickOpen((v) => !v)} aria-expanded={quickOpen}>
          <span>💡 เลือกคำถาม · อำเภอ · ตำบล · พืช</span>
          <span className="quick-caret" aria-hidden="true">{quickOpen ? 'ซ่อน ▾' : 'เปิด ▴'}</span>
        </button>
        {quickOpen && <>
          <div className="quick-pick">
            <label>อำเภอ
              <select value={selected || ''} onChange={(e) => onSelect(e.target.value || null)}>
                <option value="">ทั้งจังหวัด</option>
                {districts.map((d) => <option key={d.code} value={d.code}>{d.th}</option>)}
              </select>
            </label>
            <label>ตำบล
              <select value={tambon} onChange={(e) => setTambon(e.target.value)} disabled={!amphoe || !tambonList.length}>
                <option value="">{amphoe ? 'ทั้งอำเภอ' : 'เลือกอำเภอก่อน'}</option>
                {tambonList.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>พืช
              <select value={crop} onChange={(e) => setCrop(e.target.value)}>
                <option value="">ยังไม่เลือก</option>
                {CROP_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="quick-qs">
            {QUESTIONS.map((q) => {
              const m = missing(q);
              return <button type="button" key={q.key} className="quick-q" disabled={busy || m.length > 0}
                title={m.length ? `เลือก${m.join('และ')}ก่อน` : q.text(pick)} onClick={() => ask(q)}>{q.label}</button>;
            })}
          </div>
        </>}
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
            <svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
        <p className="disc">{isDemoChat ? 'ตัวอย่างการตอบจากข้อมูลเดิม ยังไม่ใช่ AI จริง' : 'คำตอบจาก AI เป็นแนวทางเบื้องต้น ควรตรวจสอบกับเจ้าหน้าที่เกษตรในพื้นที่'}</p>
      </form>
    </div>
  );
}