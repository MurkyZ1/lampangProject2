import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ConfirmDialog from './ui/ConfirmDialog';
import Avatar from './ui/Avatar';
import { useToast } from './ui/Toast';
import { ArrowUpRight, BookOpen, ChevronDown, UserPen, ChartColumn, FlaskConical, House, LogIn, LogOut, Menu, MessageCircle, ShieldAlert, ShieldCheck, Users, X } from 'lucide-react';

// เมนูและ routes เดิมทั้งหมด (เพิ่มเพียงไอคอน)
const links = [['/', 'หน้าแรก', House], ['/soil', 'วิเคราะห์ดิน', FlaskConical], ['/crops', 'คู่มือพืช', BookOpen], ['/dashboard', 'Dashboard', ChartColumn], ['/limitations', 'ข้อจำกัด', ShieldAlert], ['/community', 'ชุมชน', Users]];

export default function SiteHeader({ onOpenChat, path, onNavigate, user, onLogout }) {
  const [expanded, setExpanded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pill, setPill] = useState(null);
  const [askLogout, setAskLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  // ปิดเมนูบัญชีเมื่อคลิกนอกเมนู / กด Esc / เปลี่ยนหน้า
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = e => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [menuOpen]);
  useEffect(() => { setMenuOpen(false); }, [path]);
  const toast = useToast();
  async function confirmLogout() {
    setLoggingOut(true);
    try { await onLogout(); toast('ออกจากระบบเรียบร้อยแล้ว', 'success'); }
    finally { setLoggingOut(false); setAskLogout(false); }
  }
  const navRef = useRef(null);

  function go(e, to) { e.preventDefault(); setExpanded(false); onNavigate(to); }

  // ตัวบ่งชี้เมนูที่เลือก (เลื่อนตามเมนูแบบนุ่มนวล)
  useLayoutEffect(() => {
    const measure = () => {
      const el = navRef.current?.querySelector('a.on');
      setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    window.addEventListener('resize', measure);
    document.fonts?.ready?.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [path]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = e => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('menu-open');
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('menu-open'); };
  }, [expanded]);

  return <header className={`hdr ${scrolled ? 'is-scrolled' : ''} ${expanded ? 'is-open' : ''}`}>
    <div className="hdr-bar">
      <a className="logo" href="/" onClick={e => go(e, '/')} aria-label="ลำปาง ปลูกดี หน้าแรก"><img className="logo-img" src="/logo.webp" alt="" width="44" height="44" decoding="async" /></a>
      <nav className="nav" ref={navRef} aria-label="เมนูหลัก">
        {pill && <span className="nav-pill" style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} aria-hidden="true" />}
        {links.map(([url, name]) => <a key={url} href={url} className={path === url ? 'on' : ''} aria-current={path === url ? 'page' : undefined} onClick={e => go(e, url)}>{name}</a>)}
      </nav>
      <div className="header-actions">
        {user?.role === 'admin' && <button type="button" className={`header-account ${path === '/admin' ? 'on' : ''}`} onClick={() => onNavigate('/admin')}><ShieldCheck aria-hidden="true" />แอดมิน</button>}
        {user
          ? <div className={`account-menu ${menuOpen ? 'is-open' : ''}`} ref={menuRef}>
              <button type="button" className={`header-account account-trigger ${path === '/profile' ? 'on' : ''}`} onClick={() => setMenuOpen(v => !v)} aria-haspopup="menu" aria-expanded={menuOpen}><Avatar src={user.avatar} name={user.name} size={28} /><span className="header-account-name">{user.name}</span><ChevronDown className="account-caret" aria-hidden="true" /></button>
              <div className="account-dropdown" role="menu" aria-label="เมนูบัญชีผู้ใช้">
                <div className="account-dropdown-head"><Avatar src={user.avatar} name={user.name} size={44} /><div><strong>{user.name}</strong><small>{user.email}</small></div></div>
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onNavigate('/profile'); }}><UserPen aria-hidden="true" />แก้ไขโปรไฟล์</button>
                {user.role === 'admin' && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onNavigate('/admin'); }}><ShieldCheck aria-hidden="true" />จัดการรายงาน</button>}
                <button type="button" role="menuitem" className="danger" onClick={() => { setMenuOpen(false); setAskLogout(true); }}><LogOut aria-hidden="true" />ออกจากระบบ</button>
              </div>
            </div>
          : <button type="button" className={`header-account ${path === '/auth' ? 'on' : ''}`} onClick={() => onNavigate('/auth')}><LogIn aria-hidden="true" />เข้าสู่ระบบ</button>}
        <button type="button" className="btn btn-y btn-sm nav-chat" onClick={onOpenChat}>ปรึกษาการปลูก <ArrowUpRight aria-hidden="true" /></button>
        <button type="button" className="menu-toggle icon-btn" aria-label={expanded ? 'ปิดเมนู' : 'เปิดเมนู'} aria-expanded={expanded} aria-controls="mobile-nav" onClick={() => setExpanded(v => !v)}>
          <span className="menu-icon">{expanded ? <X /> : <Menu />}</span>
        </button>
      </div>
    </div>
    <div className="mobile-scrim" onClick={() => setExpanded(false)} aria-hidden="true" />
    <nav id="mobile-nav" className="mobile-nav" aria-label="เมนูสำหรับมือถือ" aria-hidden={!expanded} inert={!expanded}>
      {links.map(([url, name, Icon], i) => <a key={url} href={url} style={{ '--i': i }} className={path === url ? 'on' : ''} aria-current={path === url ? 'page' : undefined} onClick={e => go(e, url)}><Icon aria-hidden="true" />{name}</a>)}
      <div className="mobile-nav-foot">
        {user && <button type="button" className="mobile-account" onClick={() => { setExpanded(false); onNavigate('/profile'); }}><Avatar src={user.avatar} name={user.name} size={30} /><span><strong>{user.name}</strong><small>แก้ไขโปรไฟล์</small></span></button>}
        {user?.role === 'admin' && <button type="button" onClick={() => { setExpanded(false); onNavigate('/admin'); }}><ShieldCheck aria-hidden="true" />จัดการรายงาน (แอดมิน)</button>}
        {user ? <button type="button" onClick={() => { setExpanded(false); setAskLogout(true); }}><LogOut aria-hidden="true" />ออกจากระบบ</button> : <button type="button" onClick={() => { setExpanded(false); onNavigate('/auth'); }}><LogIn aria-hidden="true" />เข้าสู่ระบบ / สมัครสมาชิก</button>}
        <button type="button" className="btn btn-g" onClick={() => { setExpanded(false); onOpenChat(); }}><MessageCircle aria-hidden="true" />เปิดแชตปรึกษาการปลูก</button>
      </div>
    </nav>
    <ConfirmDialog open={askLogout} icon={LogOut} tone="danger" title="ออกจากระบบ?" message={`คุณกำลังออกจากบัญชี ${user?.name || ''} ต้องเข้าสู่ระบบใหม่ก่อนส่งรายงานครั้งถัดไป`} confirmText="ออกจากระบบ" cancelText="ยกเลิก" busy={loggingOut} onConfirm={confirmLogout} onCancel={() => !loggingOut && setAskLogout(false)} />
  </header>;
}
