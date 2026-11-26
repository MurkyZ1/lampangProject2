import { ArrowUpRight, BookOpen, ChartColumn, FlaskConical, Users } from 'lucide-react';
import { IMAGES, CROP_IMAGES } from '../data/images';
import Photo from './ui/Photo';

// คำอธิบายนำมาจากข้อความเดิมของแต่ละหน้า ไม่เพิ่มตัวเลขหรือข้อมูลใหม่
const SERVICES = [
  { to: '/soil', icon: FlaskConical, kicker: 'วิเคราะห์ดิน', title: 'ดินแบบนี้ ปลูกอะไรได้บ้าง?', text: 'ใส่ค่าดินจากผลตรวจ หรือเลือกตำบลที่มีข้อมูล เพื่อคัดกรองพืชจากค่า pH และการระบายน้ำในเบื้องต้น', img: IMAGES.soilHands },
  { to: '/crops', icon: BookOpen, kicker: 'คู่มือพืช', title: 'เลือกพืชให้ตรงกับดิน', text: 'ศึกษาความต้องการด้านดิน น้ำ และขั้นตอนการปลูกของพืชแต่ละชนิด', img: CROP_IMAGES.longan },
  { to: '/dashboard', icon: ChartColumn, kicker: 'Dashboard', title: 'จากข้อมูลดิน สู่คำแนะนำพืช', text: 'สำรวจและกรองข้อมูล แล้วดูผลจากโมเดลที่คำนวณจากข้อมูลจริงของลำปาง', img: IMAGES.aerial },
  { to: '/community', icon: Users, kicker: 'ชุมชน', title: 'รายงานสภาพพื้นที่', text: 'สมาชิกส่งความคิดเห็นและสถานะการเพาะปลูกได้ โดยแอดมินตรวจสอบก่อนแสดงต่อสาธารณะ', img: IMAGES.community },
];

export default function HomeServices({ onNavigate }) {
  return <section className="sec home-services">
    <div className="wrap">
      <div className="sec-head" data-reveal>
        <span className="kicker">สำรวจข้อมูลเพิ่ม</span>
        <h2>จากแผนที่ สู่การตัดสินใจปลูก</h2>
        <p className="subtle">เข้าไปดูข้อมูลตำบล วิเคราะห์คุณสมบัติดิน และเปรียบเทียบข้อมูลการเกษตร</p>
      </div>
      <div className="service-grid">
        {SERVICES.map(({ to, icon: Icon, kicker, title, text, img }, i) => <a key={to} href={to} className="service-card" data-reveal style={{ '--d': `${i * 70}ms` }} onClick={e => { e.preventDefault(); onNavigate(to); }}>
          <Photo img={img} className="service-photo" alt="" width={700} />
          <div className="service-body">
            <span className="service-kicker"><Icon aria-hidden="true" />{kicker}</span>
            <h3>{title}</h3>
            <p>{text}</p>
            <span className="service-link">เปิดหน้า{kicker} <ArrowUpRight aria-hidden="true" /></span>
          </div>
        </a>)}
      </div>
    </div>
  </section>;
}
