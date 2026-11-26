const links = [['/', 'หน้าแรก'], ['/soil', 'วิเคราะห์ดิน'], ['/crops', 'คู่มือพืช'], ['/dashboard', 'Dashboard'], ['/limitations', 'ข้อจำกัด'], ['/community', 'ชุมชน']];

export default function SiteFooter({ onNavigate }) {
  return <footer className="site-footer">
    <div className="wrap foot">
      <div className="foot-brand">
        <img className="logo-img logo-img--footer" src="/logo.webp" alt="โลโก้ลำปาง ปลูกดี" width="72" height="72" loading="lazy" decoding="async" />
        <p>เครื่องมือวางแผนการปลูกเบื้องต้น</p>
      </div>
      <nav className="foot-nav" aria-label="ลิงก์ท้ายเว็บ">
        {links.map(([to, name]) => <a key={to} href={to} onClick={e => { e.preventDefault(); onNavigate(to); }}>{name}</a>)}
      </nav>
      <p className="foot-note">ข้อมูลตัวอย่าง/รายงานผู้ใช้ต้องตรวจสอบก่อนนำไปใช้งานจริง</p>
    </div>
  </footer>;
}
