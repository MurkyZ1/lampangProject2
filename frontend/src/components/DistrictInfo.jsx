import { ArrowLeft, ArrowUpRight, CloudRain, Droplets, FlaskConical, Layers, MapPin, MessageCircle, Mountain, Thermometer, Waves, X } from 'lucide-react';
import { ZONE_LABEL } from '../data/districts';
import { findCrop } from '../data/cropLookup';
import { CROP_IMAGES } from '../data/images';
import Photo from './ui/Photo';

const show = v => v === null || v === undefined || v === '' ? 'ยังไม่มีข้อมูล' : String(v);
function Fact({ label, value, icon: Icon, tone, wide = false }) {
  const empty = value === null || value === undefined || value === '';
  return <div className={`fact fact--${tone} ${wide ? 'wide' : ''} ${empty ? 'is-empty' : ''}`}>
    <div className="k"><Icon aria-hidden="true" />{label}</div>
    <div className="v">{show(value)}</div>
  </div>;
}
function Crops({ items = [], onCrop }) {
  return <div className="crops">{items.length ? items.map((name, i) => {
    const crop = findCrop(name);
    const img = crop && !crop.unavailable ? CROP_IMAGES[crop.id] : null;
    return crop
      ? <button type="button" className="crop-chip" key={`${name}-${i}`} onClick={() => onCrop(crop.id)} title={`ดูคู่มือการปลูก${crop.name}`}>{img && <Photo img={img} className="crop-chip-img" alt="" width={120} />}<span>{name}</span><ArrowUpRight aria-hidden="true" /></button>
      : <span className="crop-chip crop-chip--muted" key={`${name}-${i}`}>{name} · ยังไม่มีคู่มือ</span>;
  }) : <span className="subtle">ยังไม่มีข้อมูลพืช</span>}</div>;
}

export default function DistrictInfo({ districts, selected, onSelect, onAsk, tambons = [], reports = [], selectedTambon, selectedBoundary, onChooseTambon, onCrop, onNavigate }) {
  const d = districts.find(x => x.code === selected);
  const entries = d ? tambons.filter(t => t.district.replace(/^อำเภอ/, '') === d.th.replace(/^อำเภอ/, '')) : [];
  const matched = entries.find(x => x.id === selectedTambon) || entries.find(x => selectedBoundary && (x.id === selectedBoundary.code || x.tambon.replace(/^ตำบล/, '') === selectedBoundary.name));
  const boundaryOnly = Boolean(selectedBoundary && !matched);
  const t = matched || (selectedBoundary ? {
    id: selectedBoundary.code, tambon: selectedBoundary.name, district: d?.th || '', province: 'ลำปาง',
    village: '', soilType: '', ph: '', drainage: '', water: '', crops: [], notes: '',
    source: 'GeoThai — ขอบเขตการปกครองเท่านั้น', updatedAt: '',
  } : null);
  const news = (d ? reports.filter(r => String(r.district).replace(/^อำเภอ/, '') === d.th.replace(/^อำเภอ/, '') && (!t || !r.tambon || r.tambon.replace(/^ตำบล/, '') === t.tambon.replace(/^ตำบล/, ''))).slice(0, 3) : []);

  return <aside className="info" id="info" aria-live="polite">
    {!d ? <div className="info-card info-card--empty fade-in">
      <div className="info-empty-icon" aria-hidden="true"><MapPin /></div>
      <h4>เลือกอำเภอบนแผนที่</h4>
      <p>คลิกอำเภอเพื่อซูมดูพื้นที่ และเลือกตำบลเพื่อดูข้อมูลเชิงลึก</p>
      <div className="dlist">{districts.map((x, i) => <button type="button" key={x.code} style={{ '--i': i }} onClick={() => onSelect(x.code)}><span className={`zone-dot zone-dot--${x.zone || 'none'}`} aria-hidden="true" />{x.th}</button>)}</div>
    </div> : <>
      <div className="info-card fade-in" key={`${d.code}-${t?.id || 'district'}`}>
        <div className="info-top">
          <div><div className="en">{t ? 'จังหวัดลำปาง · ' + d.th : 'อำเภอ · ' + d.en}</div><h3>{t ? `ตำบล${t.tambon}` : d.th}</h3></div>
          <span className={`zone-pill zone-pill--${t ? 'area' : d.zone || 'none'}`}>{t ? 'ข้อมูลพื้นที่' : ZONE_LABEL[d.zone] || 'ไม่ระบุเขต'}</span>
        </div>
        {t ? <>
          {boundaryOnly && <div className="alert alert--warn" role="note">แผนที่ยืนยันได้เฉพาะ <strong>ชื่อและขอบเขตตำบล</strong> ยังไม่มีค่าดิน น้ำ หรือพืชที่เหมาะสมของพื้นที่นี้ กรุณานำเข้า Data ของคุณก่อนใช้วิเคราะห์</div>}
          <p className="terrain">{t.village ? `ชุมชน/หมู่บ้าน ${t.village} · ` : ''}อำเภอ{t.district} จังหวัด{t.province}</p>
          <div className="facts">
            <Fact wide label="สภาพดินจากข้อมูลนำเข้า" value={t.soilType} icon={Layers} tone="soil" />
            <Fact label="ค่า pH ดิน" value={t.ph} icon={FlaskConical} tone="green" />
            <Fact label="การระบายน้ำ" value={t.drainage} icon={Waves} tone="green" />
            <Fact wide label="แหล่งน้ำ" value={t.water} icon={Droplets} tone="water" />
          </div>
          <div className="lbl">พืชในข้อมูลพื้นที่ · กดดูวิธีปลูก</div>
          <Crops items={t.crops} onCrop={onCrop} />
          <div className="lbl">หมายเหตุในข้อมูล</div>
          <div className="tip-box">{boundaryOnly ? 'ยังไม่ได้เชื่อมข้อมูลการเกษตรระดับตำบล' : show(t.notes)}</div>
          <p className="dataset-meta">แหล่งข้อมูล: {show(t.source)} · อัปเดต {show(t.updatedAt)}</p>
          <button type="button" className="link-btn" onClick={() => onChooseTambon(null)}><ArrowLeft aria-hidden="true" />กลับข้อมูลอำเภอ</button>
        </> : <>
          <p className="terrain"><Mountain aria-hidden="true" />{show(d.terrain)} · พื้นที่ {Number(d.area || 0).toLocaleString('th-TH')} ตร.กม. <span className="badge badge--soft">สรุปจาก Dataset จริง</span></p>
          <div className="facts">
            <Fact wide label="สภาพดิน" value={d.soil} icon={Layers} tone="soil" />
            <Fact label="ค่า pH ดิน" value={d.ph} icon={FlaskConical} tone="green" />
            <Fact label="การระบายน้ำ" value={d.drain} icon={Waves} tone="green" />
            <Fact label="อุณหภูมิ" value={d.temp} icon={Thermometer} tone="sun" />
            <Fact label="ปริมาณฝน" value={d.rain} icon={CloudRain} tone="water" />
            <Fact wide label="แหล่งน้ำ" value={d.water} icon={Droplets} tone="water" />
          </div>
          <div className="lbl">พืชที่เหมาะสม · กดดูคู่มือ</div>
          <Crops items={d.crops} onCrop={onCrop} />
          <div className="lbl">ผลจากโมเดล (ไม่ใช่ผลผลิตจริง)</div>
          <div className="tip-box">{show(d.tip)}</div>
          <div className="tambon-selection">
            <strong>เจาะลึกข้อมูลตำบล</strong>
            <span>{entries.length ? `พบข้อมูล ${entries.length} ระเบียน` : 'ยังไม่มีชุดข้อมูลระดับตำบลสำหรับอำเภอนี้'}</span>
            {entries.length ? <div className="select-wrap"><select value="" onChange={e => onChooseTambon(e.target.value)} aria-label="เลือกตำบลเพื่อดูรายละเอียด"><option value="">เลือกตำบล/ชุมชน…</option>{entries.map(x => <option key={x.id} value={x.id}>ต.{x.tambon}{x.village ? ` · ${x.village}` : ''}</option>)}</select></div> : null}
          </div>
        </>}
        {news.length > 0 && <div className="map-community-updates">
          <strong>อัปเดตจากพื้นที่ (ผ่านการตรวจสอบเพื่อเผยแพร่)</strong>
          {news.map(r => <div className="map-community-item" key={r.id}><span>{r.kind} · {r.tambon ? `ต.${r.tambon}` : 'ระดับอำเภอ'}</span><p>{r.fieldStatus || 'เผยแพร่แล้ว'}</p></div>)}
          <button type="button" className="link-btn" onClick={() => onNavigate('/community')}>ดูรายงานชุมชนทั้งหมด <ArrowUpRight aria-hidden="true" /></button>
        </div>}
      </div>
      <div className="info-actions">
        <button type="button" className="btn btn-g" onClick={() => onAsk(d, t)}><MessageCircle aria-hidden="true" />ถาม AI เกี่ยวกับ{t ? `ตำบล${t.tambon}` : `อำเภอ${d.th}`}</button>
        <button type="button" className="btn btn-o" onClick={() => { onChooseTambon(null); onSelect(null); }}><X aria-hidden="true" />กลับ</button>
      </div>
    </>}
  </aside>;
}
