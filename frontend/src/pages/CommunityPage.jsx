import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, CircleAlert, CircleCheck, Clock, FileText, Hourglass, LogIn, MapPin, MessageSquare, PenLine, Send, ShieldCheck, Sprout, Users, CircleX } from 'lucide-react';
import ImagePicker from '../components/ui/ImagePicker';
import Avatar from '../components/ui/Avatar';
import PageIntro from '../components/PageIntro';
import EmptyState from '../components/EmptyState';
import ReportGallery from '../components/community/ReportGallery';
import { KindChip, kindMeta } from '../components/community/kindMeta';
import { useToast } from '../components/ui/Toast';
import { IMAGES } from '../data/images';
import { DEMO_DISTRICTS } from '../data/districts';
import { communityRequest } from '../services/communityApi';

const kinds = ['อัปเดตการปลูก', 'ดินแห้ง', 'น้ำไม่เพียงพอ', 'พบโรคหรือแมลง', 'เริ่มเก็บเกี่ยว', 'ข้อเสนอแนะ'];
const formatTime = s => { try { return new Date(s).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return s; } };
const moderationText = { pending: 'รอผู้ดูแลตรวจสอบ', approved: 'เผยแพร่แล้ว', rejected: 'ไม่ผ่านการตรวจสอบ' };
const MOD_ICON = { pending: Hourglass, approved: CircleCheck, rejected: CircleX };
const STEPS = ['สมัครสมาชิก', 'เข้าสู่ระบบ', 'ส่งรายงาน', 'ผู้ดูแลตรวจสอบ', 'แสดงบนหน้าเว็บเมื่ออนุมัติ'];
const place = p => `อ.${p.district}${p.tambon ? ` · ต.${p.tambon}` : ''}${p.village ? ` · ${p.village}` : ''}`;

export default function CommunityPage({ tambons, user, onNavigate }) {
  const [posts, setPosts] = useState([]), [mine, setMine] = useState([]), [error, setError] = useState(''), [notice, setNotice] = useState(''), [sending, setSending] = useState(false);
  const [district, setDistrict] = useState(''), [tambon, setTambon] = useState(''), [village, setVillage] = useState(''), [crop, setCrop] = useState(''), [kind, setKind] = useState(kinds[0]), [message, setMessage] = useState(''), [isLocal, setIsLocal] = useState(false), [images, setImages] = useState([]);
  const [filter, setFilter] = useState('ทั้งหมด');
  const [loaded, setLoaded] = useState(false);
  // เปลี่ยน key เพื่อสร้างฟอร์มใหม่หลังส่งสำเร็จ: ล้างสถานะ "เคยกรอกแล้ว" ของเบราว์เซอร์ ไม่ให้ช่องที่เพิ่งล้างขึ้นเตือนสีแดง
  const [formKey, setFormKey] = useState(0);
  const toast = useToast();

  // ---- logic เดิม ----
  const load = async () => {
    try {
      const r = await communityRequest('/community/posts'); setPosts(r.posts);
      if (user) { const mineResult = await communityRequest('/community/mine'); setMine(mineResult.posts); } else setMine([]);
      setError('');
    } catch (e) { setError(e.message); } finally { setLoaded(true); }
  };
  useEffect(() => { load(); }, [user?.id]);
  const options = useMemo(() => [...new Set([...DEMO_DISTRICTS.map(d => d.th), ...tambons.map(d => d.district)])].sort((a, b) => a.localeCompare(b, 'th')), [tambons]);
  const tambonOptions = useMemo(() => [...new Set(tambons.filter(t => t.district === district).map(t => t.tambon))].sort((a, b) => a.localeCompare(b, 'th')), [tambons, district]);
  const shown = posts.filter(p => filter === 'ทั้งหมด' || p.kind === filter);
  async function send(e) {
    e.preventDefault();
    if (!user) { onNavigate('/auth'); return; }
    setSending(true); setError(''); setNotice('');
    try {
      await communityRequest('/community/posts', 'POST', { district, tambon, village, crop, kind, message, isLocal, images: images.map(i => i.dataUrl) });
      setMessage(''); setImages([]); setFormKey(k => k + 1);
      setNotice('ส่งรายงานเรียบร้อยแล้ว อยู่ระหว่างรอแอดมินตรวจสอบก่อนเผยแพร่');
      toast('ส่งรายงานเรียบร้อยแล้ว รอแอดมินตรวจสอบ', 'success');
      await load();
    } catch (e) { setError(e.message); toast(e.message, 'error'); } finally { setSending(false); }
  }
  // ---- ส่วนแสดงผล ----
  const count = k => k === 'ทั้งหมด' ? posts.length : posts.filter(p => p.kind === k).length;
  const mineCount = m => mine.filter(p => p.moderation === m).length;

  return <>
    <PageIntro eyebrow="06 / เสียงจากคนในพื้นที่" title="รายงานสภาพพื้นที่" image={IMAGES.community}
      description="สมาชิกส่งความคิดเห็นและสถานะการเพาะปลูกได้ โดยแอดมินเป็นผู้ตรวจสอบ อนุมัติ และอัปเดตสถานะก่อนแสดงต่อสาธารณะ"
      aside={<span className="source-badge"><Users aria-hidden="true" />เผยแพร่แล้ว {posts.length} รายงาน</span>} />

    <section className="wrap page-content community-page">
      {!user && <div className="flow-steps" aria-label="ขั้นตอนการเผยแพร่" data-reveal>
        <strong>ขั้นตอนการเผยแพร่:</strong>
        <ol>{STEPS.map((x, i) => <li key={x}><span>{i + 1}</span>{x}</li>)}</ol>
        <p>ข้อมูลที่ผู้ใช้รายงานยังไม่ใช่ผลสำรวจทางการ</p>
      </div>}
      {error && <div className="form-error" role="alert"><CircleAlert aria-hidden="true" />{error}</div>}
      {notice && <div className="form-success" role="status"><CircleCheck aria-hidden="true" />{notice}</div>}

      <div className="community-grid">
        {/* ---------- คอลัมน์ซ้าย: ผู้ใช้ / ฟอร์ม / รายงานของฉัน ---------- */}
        <div className="community-side">
          {user ? <>
            <div className="profile-card">
              <Avatar src={user.avatar} name={user.name} size={56} className="profile-avatar" />
              <div className="profile-name"><strong>{user.name}</strong><small>สมาชิกชุมชน{user.role === 'admin' ? ' · ผู้ดูแล' : ''}</small></div>
              <button type="button" className="profile-edit" onClick={() => onNavigate('/profile')}>แก้ไขโปรไฟล์</button>
              <dl className="profile-stats">
                <div><dt>ส่งแล้ว</dt><dd>{mine.length}</dd></div>
                <div className="is-pending"><dt>รอตรวจ</dt><dd>{mineCount('pending')}</dd></div>
                <div className="is-approved"><dt>เผยแพร่</dt><dd>{mineCount('approved')}</dd></div>
              </dl>
            </div>

            <form className="composer-card" key={formKey} onSubmit={send}>
              <div className="composer-head"><span className="composer-icon" aria-hidden="true"><PenLine /></span><div><h2>ส่งความคิดเห็น / อัปเดตพื้นที่</h2><p>รายงานจะยังไม่เผยแพร่จนกว่าแอดมินอนุมัติ</p></div></div>

              <fieldset className="composer-step">
                <legend><MapPin aria-hidden="true" />พื้นที่</legend>
                <div className="field-grid">
                  <label className="field"><span>อำเภอ <b>*</b></span><select required value={district} onChange={e => { setDistrict(e.target.value); setTambon(''); }}><option value="">เลือกอำเภอ</option>{options.map(x => <option key={x}>{x}</option>)}</select><small className="field-error">กรุณาเลือกอำเภอ</small></label>
                  <label className="field"><span>ตำบล</span><input list="community-tambons" maxLength="80" value={tambon} onChange={e => setTambon(e.target.value)} placeholder="เช่น ต.บ้านเอื้อม" /><datalist id="community-tambons">{tambonOptions.map(x => <option value={x} key={x} />)}</datalist></label>
                  <label className="field field-full"><span>หมู่บ้าน/ชุมชน (ไม่บังคับ)</span><input value={village} maxLength="80" onChange={e => setVillage(e.target.value)} placeholder="ระบุเฉพาะชื่อชุมชน ไม่ต้องระบุบ้านเลขที่" /></label>
                </div>
                <label className="check-card"><input type="checkbox" checked={isLocal} onChange={e => setIsLocal(e.target.checked)} /><span className="check-box" aria-hidden="true" /><span className="check-text"><strong>ฉันเป็นคนในพื้นที่</strong><small>อาศัยหรือทำการเกษตรในพื้นที่ที่รายงาน</small></span><BadgeCheck className="check-badge" aria-hidden="true" /></label>
              </fieldset>

              <fieldset className="composer-step">
                <legend><MessageSquare aria-hidden="true" />เรื่องที่รายงาน</legend>
                <div className="kind-grid" role="radiogroup" aria-label="ประเภทการอัปเดต">
                  {kinds.map(x => { const { icon: Icon, tone } = kindMeta(x); return <button type="button" role="radio" aria-checked={kind === x} key={x} className={`kind-option kind-option--${tone} ${kind === x ? 'active' : ''}`} onClick={() => setKind(x)}><Icon aria-hidden="true" />{x}</button>; })}
                </div>
                <label className="field"><span>พืชที่ปลูก</span><input value={crop} maxLength="80" onChange={e => setCrop(e.target.value)} placeholder="เช่น ข้าวโพด" /></label>
              </fieldset>

              <fieldset className="composer-step">
                <legend><FileText aria-hidden="true" />รายละเอียดและรูป</legend>
                <label className="field"><span>รายละเอียด <b>*</b></span><textarea required minLength="5" maxLength="1200" rows="4" value={message} onChange={e => setMessage(e.target.value)} placeholder="สังเกตอะไรในพื้นที่ และเกิดขึ้นเมื่อไร…" /><small className="field-hint">{message.length.toLocaleString('th-TH')} / 1,200 ตัวอักษร</small><small className="field-error">กรุณาเขียนรายละเอียดอย่างน้อย 5 ตัวอักษร</small></label>
                <div className="field"><span>รูปประกอบ</span><ImagePicker value={images} onChange={setImages} onError={m => toast(m, 'error')} /></div>
              </fieldset>

              <button disabled={sending} type="submit" className={`btn btn-g btn-lg composer-submit ${sending ? 'is-loading' : ''}`}><Send aria-hidden="true" />{sending ? 'กำลังส่ง…' : 'ส่งให้แอดมินตรวจสอบ'}</button>
            </form>

            <div className="my-reports">
              <h3><Clock aria-hidden="true" />รายงานที่ฉันส่ง <span className="count-pill">{mine.length}</span></h3>
              {mine.length ? <ol className="timeline">{mine.map(p => { const Icon = MOD_ICON[p.moderation] || Hourglass; return <li className={`timeline-item is-${p.moderation}`} key={p.id}>
                <span className="timeline-dot" aria-hidden="true"><Icon /></span>
                <div className="timeline-body">
                  <div className="my-report-top"><KindChip kind={p.kind} /><span className={`moderation moderation-${p.moderation}`}>{moderationText[p.moderation] || p.moderation}</span></div>
                  <small className="timeline-meta">{place(p)} · {formatTime(p.createdAt)}</small>
                  <p>{p.message}</p>
                  <ReportGallery images={p.images} size="sm" label="รูปที่ฉันแนบ" />
                  <div className="timeline-status"><ShieldCheck aria-hidden="true" /><span>สถานะพื้นที่: {p.fieldStatus || 'ยังไม่มีอัปเดต'}{p.adminNote ? ` · หมายเหตุ: ${p.adminNote}` : ''}</span></div>
                </div>
              </li>; })}</ol> : <p className="subtle">ยังไม่เคยส่งรายงาน</p>}
            </div>
          </> : <div className="community-login-cta">
            <span className="cta-icon" aria-hidden="true"><LogIn /></span>
            <h2>เข้าสู่ระบบก่อนส่งข้อมูล</h2>
            <p>หากเป็นคนในพื้นที่ คุณสามารถสมัครสมาชิกและส่งข้อมูลจริงจากแปลงของคุณให้ผู้ดูแลตรวจสอบได้</p>
            <button type="button" className="btn btn-g" onClick={() => onNavigate('/auth')}>เข้าสู่ระบบ / สมัครสมาชิก</button>
          </div>}
        </div>

        {/* ---------- คอลัมน์ขวา: ฟีดรายงานที่เผยแพร่ ---------- */}
        <div className="community-feed">
          <div className="community-feed-head">
            <div><span className="panel-kicker">หลังผ่านการตรวจสอบ</span><h2>รายงานจากคนในพื้นที่</h2></div>
            <span className="badge badge--green">{shown.length} รายงาน</span>
          </div>
          <div className="feed-filters" role="group" aria-label="กรองตามประเภท">
            <button type="button" className={`filter-pill ${filter === 'ทั้งหมด' ? 'selected' : ''}`} onClick={() => setFilter('ทั้งหมด')}>ทั้งหมด<span className="count">{count('ทั้งหมด')}</span></button>
            {kinds.map(k => { const { icon: Icon } = kindMeta(k); return <button type="button" key={k} className={`filter-pill ${filter === k ? 'selected' : ''}`} onClick={() => setFilter(k)}><Icon aria-hidden="true" />{k}<span className="count">{count(k)}</span></button>; })}
          </div>
          <div className="post-list" key={filter}>
            {!loaded ? [0, 1].map(i => <div className="post-card" key={i}><span className="skeleton" style={{ height: 44, width: 220 }} /><span className="skeleton" style={{ height: 14 }} /><span className="skeleton" style={{ height: 160 }} /></div>)
              : shown.length ? shown.map((p, i) => <article className={`post-card post-card--${kindMeta(p.kind).tone}`} key={p.id} style={{ '--i': i }}>
                <header className="post-head">
                  <Avatar src={p.authorAvatar} name={p.displayName} size={46} className="post-avatar" />
                  <div className="post-who">
                    <strong>{p.displayName}{p.isLocal && <span className="local-badge"><BadgeCheck aria-hidden="true" />คนในพื้นที่</span>}</strong>
                    <small><MapPin aria-hidden="true" />{place(p)}</small>
                  </div>
                  <time className="post-time" dateTime={p.createdAt}>{formatTime(p.createdAt)}</time>
                </header>
                <div className="post-tags"><KindChip kind={p.kind} />{p.crop && <span className="chip chip-muted"><Sprout aria-hidden="true" />{p.crop}</span>}</div>
                <p className="post-message">{p.message}</p>
                <ReportGallery images={p.images} />
                <footer className="report-status"><ShieldCheck aria-hidden="true" /><span><strong>สถานะอัปเดตโดยผู้ดูแล:</strong> {p.fieldStatus || 'เผยแพร่แล้ว'}</span>{p.updatedAt !== p.createdAt && <small>อัปเดต {formatTime(p.updatedAt)}</small>}</footer>
              </article>)
              : <div className="panel"><EmptyState icon={MessageSquare} title="ยังไม่มีรายงานที่ได้รับอนุมัติ" description="รายงานที่สมาชิกส่งจะยังไม่ปรากฏที่นี่จนกว่าผู้ดูแลตรวจสอบ" /></div>}
          </div>
        </div>
      </div>
    </section>
  </>;
}
