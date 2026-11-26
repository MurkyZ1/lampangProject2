import { ArrowDown, Map as MapIcon, MessageCircle } from 'lucide-react';
import { LAMPANG_MAP } from '../data/districts';
import { IMAGES } from '../data/images';
import Photo from './ui/Photo';

const fallbackArea = LAMPANG_MAP.districts.reduce((sum, district) => sum + Number(district.area || 0), 0);

export default function Hero({ districts = [], onOpenChat }) {
  const area = districts.length
    ? districts.reduce((sum, district) => sum + Number(district.area || 0), 0)
    : fallbackArea;

  return (
    <section className="hero" id="top">
      <Photo img={IMAGES.hero} className="hero-bg" eager alt="" width={1920} />
      <div className="hero-shade" aria-hidden="true" />
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <div className="eyebrow eyebrow--light"><i aria-hidden="true" />แผนที่เกษตร · จังหวัดลำปาง</div>
          <h1>รู้จักดินและฟ้า<br />ก่อน<em>ลงมือปลูก</em></h1>
          <p className="lead">เลือกอำเภอบนแผนที่เพื่อดูสภาพดิน อากาศ แหล่งน้ำ และพืชที่เหมาะสม หากต้องการปรึกษาเพิ่มเติม ให้เปิดแชตมุมขวาล่าง</p>
          <div className="hero-cta">
            <a className="btn btn-y btn-lg" href="#map"><MapIcon aria-hidden="true" />ดูแผนที่ 13 อำเภอ</a>
            <button type="button" className="btn btn-glass btn-lg" onClick={onOpenChat}><MessageCircle aria-hidden="true" />ถามผู้ช่วย AI</button>
          </div>
        </div>
        <div className="hero-stats" aria-label="ข้อมูลทั่วไปของจังหวัด">
          <div className="hero-stat"><b>13</b><span>อำเภอ</span></div>
          <div className="hero-stat"><b>{area.toLocaleString('th-TH')}</b><span>ตร.กม. พื้นที่จังหวัด (ข้อมูลเดิม)</span></div>
        </div>
      </div>
      <a className="hero-scroll" href="#map" aria-label="เลื่อนไปยังแผนที่"><ArrowDown aria-hidden="true" /></a>
    </section>
  );
}
