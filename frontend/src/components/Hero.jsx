import { LAMPANG_MAP } from '../data/districts';

const fallbackArea = LAMPANG_MAP.districts.reduce((sum, district) => sum + Number(district.area || 0), 0);

export default function Hero({ districts = [], onOpenChat }) {
  const area = districts.length
    ? districts.reduce((sum, district) => sum + Number(district.area || 0), 0)
    : fallbackArea;

  return (
    <section className="hero" id="top">
      <div className="wrap hero-grid">
        <div>
          <div className="eyebrow"><i aria-hidden="true" />แผนที่เกษตร · จังหวัดลำปาง</div>
          <h1>รู้จักดินและฟ้า<br />ก่อน<em>ลงมือปลูก</em></h1>
          <p className="lead">เลือกอำเภอบนแผนที่เพื่อดูสภาพดิน อากาศ แหล่งน้ำ และพืชที่เหมาะสม หากต้องการปรึกษาเพิ่มเติม ให้เปิดแชตมุมขวาล่าง</p>
          <div className="hero-cta">
            <a className="btn btn-g" href="#map">ดูแผนที่ 13 อำเภอ</a>
            <button type="button" className="btn btn-o" onClick={onOpenChat}>ถามผู้ช่วย AI</button>
          </div>
        </div>
        <div className="stats" aria-label="ข้อมูลทั่วไปของจังหวัด">
          <div className="stat g"><b>13</b><span>อำเภอ</span></div>
          <div className="stat"><b>{area.toLocaleString('th-TH')}</b><span>ตร.กม. พื้นที่จังหวัด (ข้อมูลเดิม)</span></div>
        </div>
      </div>
    </section>
  );
}
