import {useState} from 'react';
const links=[['/','หน้าแรก'],['/soil','วิเคราะห์ดิน'],['/crops','คู่มือพืช'],['/dashboard','Dashboard'],['/limitations','ข้อจำกัด'],['/community','ชุมชน']];
export default function SiteHeader({onOpenChat,path,onNavigate,user,onLogout}){
  const [expanded,setExpanded]=useState(false);
  function go(e,to){e.preventDefault();setExpanded(false);onNavigate(to);}
  return <header className="hdr hdr--extended">
    <a className="logo" href="/" onClick={e=>go(e,'/')} aria-label="ลำปาง ปลูกดี หน้าแรก"><span className="logo-mark" aria-hidden="true"/>ลำปาง<small>ปลูกดี</small></a>
    <nav className="nav nav--pages" aria-label="เมนูหลัก">{links.map(([url,name])=><a key={url} href={url} className={path===url?'on':''} aria-current={path===url?'page':undefined} onClick={e=>go(e,url)}>{name}</a>)}</nav>
    <div className="header-actions">{user?.role==='admin'&&<button type="button" className="header-account" onClick={()=>onNavigate('/admin')}>แอดมิน</button>}{user?<button className="header-account" onClick={onLogout} title="ออกจากระบบ">{user.name} · ออกจากระบบ</button>:<button className="header-account" onClick={()=>onNavigate('/auth')}>เข้าสู่ระบบ</button>}<button type="button" className="btn btn-y nav-chat" onClick={onOpenChat}>ปรึกษาการปลูก <span aria-hidden="true">↗</span></button><button type="button" className="menu-toggle" aria-label={expanded?'ปิดเมนู':'เปิดเมนู'} aria-expanded={expanded} aria-controls="mobile-nav" onClick={()=>setExpanded(v=>!v)}>{expanded?'✕':'☰'}</button></div>
    {expanded&&<nav id="mobile-nav" className="mobile-nav" aria-label="เมนูสำหรับมือถือ">{links.map(([url,name])=><a key={url} href={url} className={path===url?'on':''} onClick={e=>go(e,url)}>{name}</a>)}{user?.role==='admin'&&<button onClick={()=>{setExpanded(false);onNavigate('/admin');}}>จัดการรายงาน (แอดมิน)</button>}{user?<button onClick={()=>{setExpanded(false);onLogout();}}>ออกจากระบบ</button>:<button onClick={()=>{setExpanded(false);onNavigate('/auth');}}>เข้าสู่ระบบ / สมัครสมาชิก</button>}<button onClick={()=>{setExpanded(false);onOpenChat();}}>เปิดแชตมุมขวาล่าง ↗</button></nav>}
  </header>;
}
