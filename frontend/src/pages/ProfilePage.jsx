import { useEffect, useRef, useState } from 'react';
import { Camera, CircleAlert, Eye, EyeOff, KeyRound, Lock, LogIn, Mail, Save, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import PageIntro from '../components/PageIntro';
import EmptyState from '../components/EmptyState';
import Avatar from '../components/ui/Avatar';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { SkeletonCards } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { communityRequest, storeToken, token } from '../services/communityApi';

const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_INPUT = 10 * 1024 * 1024;   // ไฟล์ต้นฉบับก่อนย่อ
const AVATAR_SIZE = 512;
const NAME_OK = /^[A-Za-z0-9฀-๿ .\-_]+$/;
const normName = s => s.replace(/\s+/g, ' ').trim();

/** ตัดเป็นสี่เหลี่ยมจัตุรัสตรงกลาง ย่อเหลือ 512px แล้วแปลงเป็น WebP (หรือ JPEG ถ้าเบราว์เซอร์ไม่รองรับ) */
async function squareAvatar(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(AVATAR_SIZE, side);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const webp = canvas.toDataURL('image/webp', 0.86);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.86);
}

function PasswordInput({ id, label, value, onChange, autoComplete, invalid, hint, error, minLength }) {
  const [show, setShow] = useState(false);
  return <label className="field" htmlFor={id}>
    <span>{label}</span>
    <div className="input-icon">
      <Lock aria-hidden="true" />
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} autoComplete={autoComplete} required minLength={minLength} maxLength={128} aria-invalid={invalid || undefined} className={invalid ? 'is-invalid' : ''} />
      <button type="button" className="icon-btn icon-btn--sm input-action" onClick={() => setShow(v => !v)} aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={show}>{show ? <EyeOff /> : <Eye />}</button>
    </div>
    {invalid && error ? <small className="field-msg field-msg--error">{error}</small> : hint ? <small className="field-hint">{hint}</small> : null}
  </label>;
}

export default function ProfilePage({ user, onUserChange, onNavigate }) {
  const toast = useToast();
  const fileRef = useRef(null);

  // ---- รูปโปรไฟล์ ----
  const [preview, setPreview] = useState(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [askRemove, setAskRemove] = useState(false);

  // ---- ชื่อ ----
  const [name, setName] = useState(user?.name || '');
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);
  useEffect(() => { setName(user?.name || ''); }, [user?.name]);

  // ---- รหัสผ่าน ----
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwTouched, setPwTouched] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwFormKey, setPwFormKey] = useState(0);   // สร้างฟอร์มใหม่หลังสำเร็จ: ล้างสถานะ "เคยกรอก" ของเบราว์เซอร์

  if (!user) {
    return <section className="wrap page-content">{token()
      ? <SkeletonCards count={2} h={180} />
      : <div className="panel"><EmptyState icon={LogIn} title="กรุณาเข้าสู่ระบบก่อน" description="หน้านี้ใช้แก้ไขข้อมูลบัญชีของคุณ" action={<button type="button" className="btn btn-g" onClick={() => onNavigate('/auth')}>เข้าสู่ระบบ</button>} /></div>}
    </section>;
  }

  async function pickAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) { toast('รองรับเฉพาะไฟล์ JPG, JPEG, PNG และ WEBP', 'error'); return; }
    if (file.size > AVATAR_MAX_INPUT) { toast('ไฟล์ใหญ่เกิน 10 MB กรุณาเลือกรูปที่เล็กลง', 'error'); return; }
    try { setPreview(await squareAvatar(file)); } catch { toast('อ่านไฟล์รูปไม่ได้ ลองเลือกรูปอื่น', 'error'); }
  }
  async function saveAvatar() {
    setSavingAvatar(true);
    try {
      const r = await communityRequest('/auth/avatar', 'POST', { image: preview });
      onUserChange(r.user); setPreview(null); toast(r.message || 'เปลี่ยนรูปโปรไฟล์เรียบร้อยแล้ว', 'success');
    } catch (e) { toast(e.message, 'error'); } finally { setSavingAvatar(false); }
  }
  async function removeAvatar() {
    setSavingAvatar(true);
    try {
      const r = await communityRequest('/auth/avatar', 'DELETE');
      onUserChange(r.user); toast('ลบรูปโปรไฟล์แล้ว', 'success');
    } catch (e) { toast(e.message, 'error'); } finally { setSavingAvatar(false); setAskRemove(false); }
  }

  const cleanName = normName(name);
  const nameChanged = cleanName !== user.name;
  const nameLocalError = !cleanName ? 'กรุณากรอกชื่อ'
    : cleanName.length < 2 || cleanName.length > 80 ? 'ชื่อต้องยาว 2–80 ตัวอักษร'
    : !NAME_OK.test(cleanName) ? 'ใช้ได้เฉพาะภาษาไทย ภาษาอังกฤษ ตัวเลข เว้นวรรค และ . - _' : '';
  async function saveName(e) {
    e.preventDefault();
    if (nameLocalError) { setNameError(nameLocalError); return; }
    setSavingName(true); setNameError('');
    try {
      const r = await communityRequest('/auth/profile', 'PATCH', { name: cleanName });
      onUserChange(r.user); setName(r.user.name); toast(r.message || 'บันทึกชื่อเรียบร้อยแล้ว', 'success');
    } catch (err) { setNameError(err.message); toast(err.message, 'error'); } finally { setSavingName(false); }
  }

  const pwChecks = { length: pw.next.length >= 8, match: pw.next !== '' && pw.next === pw.confirm, differ: pw.next !== '' && pw.next !== pw.current };
  const pwValid = pw.current && pwChecks.length && pwChecks.match && pwChecks.differ;
  async function savePassword(e) {
    e.preventDefault();
    setPwTouched(true);
    if (!pwValid) { setPwError('กรุณาตรวจสอบเงื่อนไขรหัสผ่านให้ครบ'); return; }
    setSavingPw(true); setPwError('');
    try {
      const r = await communityRequest('/auth/password', 'POST', { currentPassword: pw.current, newPassword: pw.next });
      storeToken(r.token); onUserChange(r.user);
      setPw({ current: '', next: '', confirm: '' }); setPwTouched(false); setPwFormKey(k => k + 1);
      toast(r.message || 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว', 'success');
    } catch (err) { setPwError(err.message); toast(err.message, 'error'); } finally { setSavingPw(false); }
  }
  const strength = pw.next.length >= 12 && /[^A-Za-z0-9]/.test(pw.next) ? 3 : pw.next.length >= 10 ? 2 : pw.next.length >= 8 ? 1 : 0;

  return <>
    <PageIntro eyebrow="บัญชีของฉัน" title="แก้ไขโปรไฟล์" description="จัดการรูปโปรไฟล์ ชื่อที่แสดง และรหัสผ่านของบัญชีคุณ ข้อมูลจะอัปเดตทุกส่วนของเว็บไซต์ทันทีหลังบันทึก" />
    <section className="wrap page-content profile-page">
      <div className="profile-layout">
        {/* ---------- รูปโปรไฟล์ ---------- */}
        <section className="profile-section profile-avatar-section" aria-labelledby="sec-avatar" data-reveal>
          <div className="profile-section-head"><span className="profile-section-icon"><Camera aria-hidden="true" /></span><div><h2 id="sec-avatar">รูปโปรไฟล์</h2><p>JPG, JPEG, PNG หรือ WEBP · ระบบตัดเป็นสี่เหลี่ยมจัตุรัสให้</p></div></div>
          <div className="avatar-editor">
            <div className={`avatar-stage ${preview ? 'has-preview' : ''}`}>
              {preview ? <span className="avatar avatar-xl fade-zoom-in"><img src={preview} alt="ตัวอย่างรูปโปรไฟล์ใหม่" /></span> : <Avatar src={user.avatar} name={user.name} size={148} className="avatar-xl" />}
              <button type="button" className="avatar-camera" onClick={() => fileRef.current?.click()} aria-label="เลือกรูปโปรไฟล์ใหม่" data-tip="เปลี่ยนรูป"><Camera /></button>
              {preview && <span className="badge badge--soft avatar-preview-badge">ตัวอย่าง · ยังไม่บันทึก</span>}
            </div>
            <input ref={fileRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={pickAvatar} aria-label="เลือกไฟล์รูปโปรไฟล์" />
            <div className="avatar-actions">
              {preview ? <>
                <button type="button" className={`btn btn-g ${savingAvatar ? 'is-loading' : ''}`} onClick={saveAvatar} disabled={savingAvatar}><Save aria-hidden="true" />บันทึกรูป</button>
                <button type="button" className="btn btn-o" onClick={() => setPreview(null)} disabled={savingAvatar}><X aria-hidden="true" />ยกเลิก</button>
              </> : <>
                <button type="button" className="btn btn-o" onClick={() => fileRef.current?.click()}><Camera aria-hidden="true" />อัปโหลดรูปใหม่</button>
                {user.avatar && <button type="button" className="btn btn-ghost" onClick={() => setAskRemove(true)} disabled={savingAvatar}><Trash2 aria-hidden="true" />ลบรูป</button>}
              </>}
            </div>
          </div>
        </section>

        {/* ---------- ข้อมูลส่วนตัว ---------- */}
        <form className="profile-section" onSubmit={saveName} aria-labelledby="sec-info" noValidate data-reveal style={{ '--d': '60ms' }}>
          <div className="profile-section-head"><span className="profile-section-icon"><UserRound aria-hidden="true" /></span><div><h2 id="sec-info">ข้อมูลส่วนตัว</h2><p>ชื่อที่แสดงบน Navbar และในรายงานชุมชน (รายงานเดิมของคุณจะเปลี่ยนชื่อตามด้วย)</p></div></div>
          <label className="field" htmlFor="profile-name">
            <span>ชื่อที่แสดง</span>
            <div className="input-icon"><UserRound aria-hidden="true" /><input id="profile-name" value={name} maxLength={80} onChange={e => { setName(e.target.value); setNameError(''); }} autoComplete="nickname" aria-invalid={Boolean(nameError || (nameChanged && nameLocalError)) || undefined} className={nameError || (nameChanged && nameLocalError) ? 'is-invalid' : ''} /></div>
            {nameError || (nameChanged && nameLocalError) ? <small className="field-msg field-msg--error"><CircleAlert aria-hidden="true" />{nameError || nameLocalError}</small> : <small className="field-hint">2–80 ตัวอักษร · ภาษาไทยหรืออังกฤษ · ห้ามซ้ำกับผู้ใช้อื่น</small>}
          </label>
          <label className="field" htmlFor="profile-email">
            <span>อีเมล / ไอดีที่ใช้เข้าสู่ระบบ</span>
            <div className="input-icon"><Mail aria-hidden="true" /><input id="profile-email" value={user.email} readOnly disabled /></div>
            <small className="field-hint"><Lock aria-hidden="true" className="inline-icon" />เปลี่ยนไม่ได้ เพื่อใช้ยืนยันตัวตนของบัญชี</small>
          </label>
          <div className="profile-actions">
            <button type="button" className="btn btn-o" onClick={() => { setName(user.name); setNameError(''); }} disabled={!nameChanged || savingName}>ยกเลิก</button>
            <button type="submit" className={`btn btn-g ${savingName ? 'is-loading' : ''}`} disabled={!nameChanged || savingName}><Save aria-hidden="true" />บันทึกการเปลี่ยนแปลง</button>
          </div>
        </form>

        {/* ---------- ความปลอดภัย ---------- */}
        <form className="profile-section profile-security" key={pwFormKey} onSubmit={savePassword} aria-labelledby="sec-security" noValidate data-reveal style={{ '--d': '120ms' }}>
          <div className="profile-section-head"><span className="profile-section-icon tone-danger"><ShieldCheck aria-hidden="true" /></span><div><h2 id="sec-security">ความปลอดภัยของบัญชี</h2><p>เปลี่ยนรหัสผ่านแล้ว อุปกรณ์อื่นที่ล็อกอินบัญชีนี้อยู่จะถูกออกจากระบบ</p></div></div>
          {!user.hasPassword ? <div className="notice"><KeyRound aria-hidden="true" /><span>บัญชีนี้เข้าสู่ระบบด้วย Google จึงไม่มีรหัสผ่านให้เปลี่ยน จัดการความปลอดภัยได้ที่บัญชี Google ของคุณ</span></div> : <>
            <PasswordInput id="pw-current" label="รหัสผ่านปัจจุบัน" value={pw.current} onChange={v => { setPw(p => ({ ...p, current: v })); setPwError(''); }} autoComplete="current-password" invalid={pwTouched && !pw.current} error="กรุณากรอกรหัสผ่านปัจจุบัน" />
            <PasswordInput id="pw-new" label="รหัสผ่านใหม่" value={pw.next} onChange={v => { setPw(p => ({ ...p, next: v })); setPwError(''); }} autoComplete="new-password" minLength={8} invalid={(pwTouched || pw.next) && !pwChecks.length} error="อย่างน้อย 8 ตัวอักษร" />
            <div className="pw-meter" aria-hidden="true"><i className={['', 'is-1', 'is-2', 'is-3'][strength]} /></div>
            <PasswordInput id="pw-confirm" label="ยืนยันรหัสผ่านใหม่" value={pw.confirm} onChange={v => { setPw(p => ({ ...p, confirm: v })); setPwError(''); }} autoComplete="new-password" invalid={(pwTouched || pw.confirm) && !pwChecks.match} error="รหัสผ่านยืนยันไม่ตรงกัน" />
            <ul className="pw-rules" aria-label="เงื่อนไขรหัสผ่าน">
              <li className={pwChecks.length ? 'ok' : ''}>ยาวอย่างน้อย 8 ตัวอักษร</li>
              <li className={pwChecks.match ? 'ok' : ''}>รหัสผ่านใหม่และยืนยันตรงกัน</li>
              <li className={pwChecks.differ ? 'ok' : ''}>ไม่ซ้ำกับรหัสผ่านปัจจุบัน</li>
            </ul>
            {pwError && <p className="form-error" role="alert"><CircleAlert aria-hidden="true" />{pwError}</p>}
            <div className="profile-actions">
              <button type="button" className="btn btn-o" onClick={() => { setPw({ current: '', next: '', confirm: '' }); setPwError(''); setPwTouched(false); setPwFormKey(k => k + 1); }} disabled={savingPw || (!pw.current && !pw.next && !pw.confirm)}>ยกเลิก</button>
              <button type="submit" className={`btn btn-g ${savingPw ? 'is-loading' : ''}`} disabled={savingPw}><KeyRound aria-hidden="true" />เปลี่ยนรหัสผ่าน</button>
            </div>
          </>}
        </form>
      </div>
    </section>
    <ConfirmDialog open={askRemove} icon={Trash2} tone="danger" title="ลบรูปโปรไฟล์?" message="ระบบจะกลับไปใช้รูปเริ่มต้นแทน" confirmText="ลบรูป" busy={savingAvatar} onConfirm={removeAvatar} onCancel={() => !savingAvatar && setAskRemove(false)} />
  </>;
}
