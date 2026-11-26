import { useMemo, useState, useEffect, useRef } from 'react';
import { ArrowRight, CalendarDays, Droplets, FlaskConical, Layers, Search, ShieldAlert, Sprout, TriangleAlert, Waves, X } from 'lucide-react';
import PageIntro from '../components/PageIntro';
import EmptyState from '../components/EmptyState';
import Photo from '../components/ui/Photo';
import { CROP_GUIDE } from '../data/cropGuide';
import { CROP_IMAGES, IMAGES } from '../data/images';

export default function CropsPage({ selectedCrop, onNavigate }) {
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('ทั้งหมด'); const [active, setActive] = useState(selectedCrop || 'rice');
  const detailRef = useRef(null);
  useEffect(() => { if (selectedCrop) setActive(selectedCrop); }, [selectedCrop]);
  const categories = ['ทั้งหมด', ...new Set(CROP_GUIDE.map(c => c.category))];
  const crops = useMemo(() => CROP_GUIDE.filter(c => (category === 'ทั้งหมด' || c.category === category) && c.name.includes(query.trim())), [query, category]);
  const crop = CROP_GUIDE.find(c => c.id === active) || { id: active, name: active || 'ยังไม่มีข้อมูล', emoji: '🌱', category: 'กำลังเพิ่มคู่มือ', ph: null, texture: 'ยังไม่มีข้อมูลเฉพาะชนิดพืช', drainage: 'ยังไม่มีข้อมูล', water: 'ยังไม่มีข้อมูล', season: 'ควรตรวจสอบพันธุ์และฤดูปลูกกับหน่วยงานการเกษตรในพื้นที่', steps: ['ตรวจคุณสมบัติดินและแหล่งน้ำของแปลงจริง', 'ศึกษาข้อแนะนำเฉพาะชนิดและพันธุ์จากแหล่งข้อมูลที่เชื่อถือได้', 'วางแผนปลูกตามฤดูกาลและติดตามผลการปลูก'], care: 'ขอคำแนะนำจากผู้เชี่ยวชาญในพื้นที่', caution: 'ยังไม่มีคู่มือเฉพาะพืชนี้ในระบบ ห้ามใช้ข้อมูลทั่วไปแทนคำแนะนำเฉพาะพันธุ์', unavailable: true };
  const choose = id => {
    setActive(id);
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  // ตำแหน่ง pH บนสเกล 0–14 (แสดงช่วงเดิมของคู่มือ ไม่ได้คำนวณค่าใหม่)
  const phBar = crop.ph ? { left: `${crop.ph[0] / 14 * 100}%`, width: `${(crop.ph[1] - crop.ph[0]) / 14 * 100}%` } : null;

  return <>
    <PageIntro eyebrow="03 / คลังความรู้พืช" title="เลือกพืชให้ตรงกับดิน" description="ศึกษาความต้องการด้านดิน น้ำ และขั้นตอนการปลูกของพืชแต่ละชนิด ก่อนนำไปปรับใช้กับผลตรวจดินในแปลง" image={IMAGES.terrace} aside={<span className="source-badge"><Sprout aria-hidden="true" />คู่มือทั่วไป {CROP_GUIDE.length} ชนิด · ไม่ใช่คำรับรองผลผลิต</span>} />
    <section className="wrap page-content">
      <div className="toolbar" data-reveal>
        <label className="search-bar">
          <Search aria-hidden="true" />
          <span className="sr-only">ค้นหาพืช</span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาพืช เช่น ข้าว มะม่วง ลำไย" />
          {query && <button type="button" className="icon-btn icon-btn--sm" onClick={() => setQuery('')} aria-label="ล้างคำค้นหา"><X /></button>}
        </label>
        <div className="filter-pills" role="group" aria-label="ประเภทพืช">{categories.map(c => <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c} className={`filter-pill ${category === c ? 'selected' : ''}`}>{c}<span className="count">{c === 'ทั้งหมด' ? CROP_GUIDE.length : CROP_GUIDE.filter(x => x.category === c).length}</span></button>)}</div>
      </div>

      {crops.length ? <div className="crop-catalog" key={`${category}-${query}`}>
        {crops.map((c, i) => <button type="button" key={c.id} style={{ '--i': i }} onClick={() => choose(c.id)} className={`crop-card ${active === c.id ? 'active' : ''}`} aria-pressed={active === c.id}>
          <Photo img={CROP_IMAGES[c.id]} className="crop-card-img" alt="" width={600} />
          <span className="crop-card-body"><strong>{c.name}</strong><small>{c.category}</small></span>
          {c.ph && <span className="crop-card-ph">pH {c.ph[0]}–{c.ph[1]}</span>}
        </button>)}
      </div> : <div className="panel"><EmptyState icon={Search} title="ไม่พบพืชที่ค้นหา" description="ลองค้นหาด้วยชื่ออื่น" action={<button type="button" className="btn btn-o btn-sm" onClick={() => { setQuery(''); setCategory('ทั้งหมด'); }}>ล้างตัวกรอง</button>} /></div>}

      <div ref={detailRef} className="crop-detail-anchor" />
      {crop.unavailable && <div className="demo-alert"><TriangleAlert aria-hidden="true" />พืชนี้ยังไม่มีคู่มือเฉพาะในข้อมูลเริ่มต้น ระบบแสดงคำแนะนำทั่วไปโดยไม่แต่งค่าดินหรือช่วง pH ขึ้นเอง</div>}
      <article className="crop-feature fade-in" key={crop.id}>
        <div className="crop-feature-hero">
          <Photo img={crop.unavailable ? IMAGES.sprout : CROP_IMAGES[crop.id]} className="crop-feature-img" width={1400} />
          <div className="crop-feature-shade" aria-hidden="true" />
          <div className="crop-feature-title">
            <span className="badge badge--glass">คู่มือการปลูก · {crop.category}</span>
            <h2>{crop.name}</h2>
            <p>ข้อมูลประกอบการตัดสินใจเบื้องต้น ควรอ้างอิงคำแนะนำเฉพาะพันธุ์และพื้นที่จริงเพิ่มเติม</p>
          </div>
        </div>
        <div className="crop-feature-facts">
          <div className="cf-ph"><span><FlaskConical aria-hidden="true" />ช่วง pH ทั่วไป</span><strong>{crop.ph ? `${crop.ph[0]} – ${crop.ph[1]}` : 'ยังไม่มีข้อมูล'}</strong>
            {phBar && <div className="ph-scale" aria-hidden="true"><i style={phBar} /><em>0</em><em>7</em><em>14</em></div>}
          </div>
          <div><span><Layers aria-hidden="true" />ลักษณะดิน</span><strong>{crop.texture}</strong></div>
          <div><span><Waves aria-hidden="true" />การระบายน้ำ</span><strong>{crop.drainage}</strong></div>
          <div><span><Droplets aria-hidden="true" />น้ำที่ต้องการ</span><strong>{crop.water}</strong></div>
        </div>
        <div className="crop-feature-body">
          <div>
            <h3>วิธีปลูกทีละขั้นตอน</h3>
            <ol className="crop-steps">{crop.steps.map((s, i) => <li key={s} style={{ '--i': i }}><span>{String(i + 1).padStart(2, '0')}</span><p>{s}</p></li>)}</ol>
          </div>
          <aside className="guide-stack">
            <div className="guide-box"><h3><CalendarDays aria-hidden="true" />ช่วงปลูกที่ควรพิจารณา</h3><p>{crop.season}</p></div>
            <div className="guide-box"><h3><Sprout aria-hidden="true" />การดูแล</h3><p>{crop.care}</p></div>
            <div className="guide-box guide-warning"><h3><ShieldAlert aria-hidden="true" />ข้อควรระวัง</h3><p>{crop.caution}</p></div>
            <button type="button" className="btn btn-g" onClick={() => onNavigate('/soil')}>ตรวจสอบกับค่าดินของฉัน <ArrowRight aria-hidden="true" /></button>
          </aside>
        </div>
      </article>
    </section>
  </>;
}
