import {useMemo,useState,useEffect} from 'react';
import PageIntro from '../components/PageIntro';
import EmptyState from '../components/EmptyState';
import {CROP_GUIDE} from '../data/cropGuide';
export default function CropsPage({selectedCrop,onNavigate}){
  const [query,setQuery]=useState('');const [category,setCategory]=useState('ทั้งหมด');const [active,setActive]=useState(selectedCrop||'rice');
  useEffect(()=>{if(selectedCrop)setActive(selectedCrop);},[selectedCrop]);
  const categories=['ทั้งหมด',...new Set(CROP_GUIDE.map(c=>c.category))];
  const crops=useMemo(()=>CROP_GUIDE.filter(c=>(category==='ทั้งหมด'||c.category===category)&&c.name.includes(query.trim())),[query,category]);
  const crop=CROP_GUIDE.find(c=>c.id===active)||{id:active,name:active||'ยังไม่มีข้อมูล',emoji:'🌱',category:'กำลังเพิ่มคู่มือ',ph:null,texture:'ยังไม่มีข้อมูลเฉพาะชนิดพืช',drainage:'ยังไม่มีข้อมูล',water:'ยังไม่มีข้อมูล',season:'ควรตรวจสอบพันธุ์และฤดูปลูกกับหน่วยงานการเกษตรในพื้นที่',steps:['ตรวจคุณสมบัติดินและแหล่งน้ำของแปลงจริง','ศึกษาข้อแนะนำเฉพาะชนิดและพันธุ์จากแหล่งข้อมูลที่เชื่อถือได้','วางแผนปลูกตามฤดูกาลและติดตามผลการปลูก'],care:'ขอคำแนะนำจากผู้เชี่ยวชาญในพื้นที่',caution:'ยังไม่มีคู่มือเฉพาะพืชนี้ในระบบ ห้ามใช้ข้อมูลทั่วไปแทนคำแนะนำเฉพาะพันธุ์',unavailable:true};
  return <>
    <PageIntro eyebrow="03 / คลังความรู้พืช" title="เลือกพืชให้ตรงกับดิน" description="ศึกษาความต้องการด้านดิน น้ำ และขั้นตอนการปลูกของพืชแต่ละชนิด ก่อนนำไปปรับใช้กับผลตรวจดินในแปลง" aside={<span className="source-badge">คู่มือทั่วไป {CROP_GUIDE.length} ชนิด · ไม่ใช่คำรับรองผลผลิต</span>}/>
    <section className="wrap page-content">
      <div className="panel filter-bar crop-filters"><label className="field"><span>ค้นหาพืช</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="เช่น ข้าว มะม่วง พริก"/></label><div className="filter-pills" aria-label="ประเภทพืช">{categories.map(c=><button key={c} type="button" onClick={()=>setCategory(c)} className={`filter-pill ${category===c?'selected':''}`}>{c}</button>)}</div></div>
      <div className="crop-catalog">{crops.length?crops.map(c=><button key={c.id} onClick={()=>setActive(c.id)} className={`crop-pick ${active===c.id?'active':''}`}><span>{c.emoji}</span><strong>{c.name}</strong><small>{c.category}</small></button>):<EmptyState title="ไม่พบพืชที่ค้นหา" description="ลองค้นหาด้วยชื่ออื่น"/>}</div>
      {crop.unavailable&&<div className="demo-alert">พืชนี้ยังไม่มีคู่มือเฉพาะในข้อมูลเริ่มต้น ระบบแสดงคำแนะนำทั่วไปโดยไม่แต่งค่าดินหรือช่วง pH ขึ้นเอง</div>}<article className="panel crop-feature" key={crop.id}><div className="crop-feature-hero"><div><span className="panel-kicker">คู่มือการปลูก · {crop.category}</span><h2>{crop.name}</h2><p>ข้อมูลประกอบการตัดสินใจเบื้องต้น ควรอ้างอิงคำแนะนำเฉพาะพันธุ์และพื้นที่จริงเพิ่มเติม</p></div><span className="crop-feature-icon" aria-hidden="true">{crop.emoji}</span></div>
        <div className="crop-feature-facts"><div><span>ช่วง pH ทั่วไป</span><strong>{crop.ph?`${crop.ph[0]} – ${crop.ph[1]}`:'ยังไม่มีข้อมูล'}</strong></div><div><span>ลักษณะดิน</span><strong>{crop.texture}</strong></div><div><span>การระบายน้ำ</span><strong>{crop.drainage}</strong></div><div><span>น้ำที่ต้องการ</span><strong>{crop.water}</strong></div></div>
        <div className="crop-feature-body"><div><h3>วิธีปลูกทีละขั้นตอน</h3><ol className="crop-steps">{crop.steps.map((s,i)=><li key={s}><span>{String(i+1).padStart(2,'0')}</span><p>{s}</p></li>)}</ol></div><aside><div className="guide-box"><h3>ช่วงปลูกที่ควรพิจารณา</h3><p>{crop.season}</p></div><div className="guide-box"><h3>การดูแล</h3><p>{crop.care}</p></div><div className="guide-box guide-warning"><h3>ข้อควรระวัง</h3><p>{crop.caution}</p></div><button className="btn btn-g" onClick={()=>onNavigate('/soil')}>ตรวจสอบกับค่าดินของฉัน →</button></aside></div>
      </article>
    </section>
  </>;
}
