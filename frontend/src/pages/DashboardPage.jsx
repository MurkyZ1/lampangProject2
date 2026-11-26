import { useEffect, useMemo, useRef, useState } from 'react';
import PageIntro from '../components/PageIntro';
import EmptyState from '../components/EmptyState';
import { ArrowRight, ChartColumn, Database, Filter, Info, Layers, RefreshCw, Sprout, Target, TriangleAlert, TreePine } from 'lucide-react';
import { BarList, Heatmap, Histogram, Kpi, fmt } from '../components/charts';
import { SkeletonCards } from '../components/ui/Skeleton';
import { IMAGES } from '../data/images';
import { loadDashboard } from '../services/modelService';

const VAR_INFO = {
  pH_top_mid: { name: 'pH ดินชั้นบน', x: 'ค่า pH (ต่ำ = ดินเปรี้ยว · 7 = กลาง · สูง = ดินด่าง)', what: 'ความเป็นกรด–ด่างของดิน พืชส่วนใหญ่ชอบ pH ราว 5.5–7' },
  slope_mid: { name: 'ความลาดชัน', x: 'ความลาดชันของพื้นที่ (%) · ยิ่งมากยิ่งชัน', what: 'พื้นที่ชันปลูกยากและดินพังง่าย' },
  depth_mid: { name: 'ความลึกของดิน', x: 'ความลึกดินก่อนถึงชั้นหินหรือชั้นแข็ง (ซม.)', what: 'ดินลึกรากพืชหยั่งได้ดี ดินตื้นปลูกพืชรากลึกไม่ได้' },
  Gravel_mid: { name: 'กรวด/ก้อนหินในดิน', x: 'สัดส่วนกรวดหรือก้อนหินในดิน (%)', what: 'มีกรวดมากดินเก็บน้ำและธาตุอาหารได้น้อย' },
  drainage_ord: { name: 'การระบายน้ำของดิน', x: 'ระดับการระบายน้ำ', what: 'ดินระบายน้ำไม่ดีน้ำขัง เหมาะกับข้าว แต่ไม่เหมาะกับพืชที่รากกลัวน้ำขัง' },
  fertility_ord: { name: 'ความอุดมสมบูรณ์ของดิน', x: 'ระดับความอุดมสมบูรณ์', what: 'ปริมาณธาตุอาหารที่ดินเก็บไว้ให้พืช' },
  tex_top_ord: { name: 'เนื้อดินชั้นบน', x: 'ชนิดเนื้อดิน (จากทรายมากไปเหนียวมาก)', what: 'เนื้อดินมีผลต่อการอุ้มน้ำและการระบายน้ำ' },
};

function Pipeline({ stage, onStage, data }) {
  const src = data?.eda.sources ?? [];
  return (
    <div className="pipeline" aria-label="ขั้นตอนข้อมูลสู่ Dashboard">
      <div className="pipe-box pipe-src">
        <b><Database aria-hidden="true" />แหล่งข้อมูล</b>
        <div className="pipe-src-list">{src.length ? src.map((s) => <span key={s.name} data-tip={s.detail}>{s.name}</span>) : <span className="skeleton" style={{ width: 120, height: 22 }} />}</div>
      </div>
      <span className="pipe-arrow" aria-hidden="true"><ArrowRight /></span>
      <div className="pipe-tabs" role="tablist" aria-label="เลือกส่วนของ Dashboard">
        <span className={`pipe-ink ${stage === 'final' ? 'is-right' : ''}`} aria-hidden="true" />
        <button role="tab" aria-selected={stage === 'eda'} className={`pipe-btn${stage === 'eda' ? ' on' : ''}`} onClick={() => onStage('eda')}>
          <b><Filter aria-hidden="true" />1 · EDA process</b><span>สำรวจ · กรอง · ทำความสะอาด</span>
        </button>
        <button role="tab" aria-selected={stage === 'final'} className={`pipe-btn${stage === 'final' ? ' on' : ''}`} onClick={() => onStage('final')}>
          <b><Target aria-hidden="true" />2 · Final Dashboard</b><span>ผลจากโมเดล ML</span>
        </button>
      </div>
    </div>
  );
}

function EdaPart({ eda }) {
  const [dist, setDist] = useState(eda.distributions[0].key);
  const d = eda.distributions.find((x) => x.key === dist);
  const o = eda.overview;
  const info = VAR_INFO[dist];
  const tb = d.bins.reduce((a, b) => (b.count > a.count ? b : a), d.bins[0]);
  const top = `พบมากที่สุดที่ "${tb.label}" (${Math.round(tb.count / d.bins.reduce((s, b) => s + b.count, 0) * 100)}% ของแปลง)`;
  return (
    <>
      <div className="dashboard-kpis four">
        <Kpi icon={Layers} label="แปลงดิน" value={fmt(o.rows)} hint={`${o.tambons} ตำบล · ${o.amphoes} อำเภอ`} />
        <Kpi icon={TreePine} tone="soil" label="พื้นที่รวม" value={`${(o.areaRai / 1e6).toFixed(2)} ล้านไร่`} />
        <Kpi icon={Filter} tone="water" label="ตัวแปรที่ใช้เรียน" value={o.featuresUsed} hint="หลังกรองแล้ว" />
        <Kpi icon={Sprout} tone="sun" label="พืชที่ประเมิน" value={o.crops} />
      </div>

      <div>
        <section className="panel chart-panel" data-reveal>
          <div className="chart-heading"><h3>การกระจายของตัวแปร</h3><span className="chart-sub">เลือกตัวแปรเพื่อดูกราฟ</span></div>
          <div className="filter-pills">
            {eda.distributions.map((x) => (
              <button key={x.key} className={`filter-pill${dist === x.key ? ' selected' : ''}`} onClick={() => setDist(x.key)}>{x.label}</button>
            ))}
          </div>
          <p className="hist-intro"><Info aria-hidden="true" /><span><b>{info.name}</b> — {info.what}</span></p>
          <Histogram key={dist} bins={d.bins} xTitle={info.x} />
          <p className="chart-note">อ่านกราฟ: แท่งยิ่งสูง = มีแปลงดินที่ค่านั้นมาก · ตัวเลขบนแท่งคือจำนวนแปลง และ % ของแปลงทั้งหมด · {top}</p>
        </section>

      </div>

      <section className="panel chart-panel" data-reveal>
        <div className="chart-heading"><h3>ความสัมพันธ์ระหว่างตัวแปร (correlation)</h3></div>
        <Heatmap rows={eda.correlation.labels} cols={eda.correlation.labels} matrix={eda.correlation.matrix} diverging />
        <p className="chart-note">เขียว = สัมพันธ์ไปทางเดียวกัน · แดง = สวนทางกัน</p>
      </section>

    </>
  );
}

function FinalPart({ fin }) {
  const [amphoe, setAmphoe] = useState('ทั้งหมด');
  const [crop, setCrop] = useState(fin.crops[0].name);
  const ci = fin.crops.findIndex((c) => c.name === crop);
  const judge = fin.crops[ci]?.judgeable;
  const ranking = useMemo(() => {
    const rows = fin.tambons.filter((t) => amphoe === 'ทั้งหมด' || t.amphoe === amphoe)
      .map((t) => ({ label: `${t.tambon} (${t.amphoe})`, v: Math.round(t.scores[ci] * 100) }));
    rows.sort((a, b) => b.v - a.v);
    return rows.slice(0, 10);
  }, [fin, amphoe, ci]);
  const m = fin.model;
  return (
    <>
      <div className="alert alert--warn caveat" role="note"><TriangleAlert aria-hidden="true" /><span>{fin.caveat}</span></div>
      <div className="dashboard-kpis four">
        <Kpi icon={Sprout} label="พืชที่เหมาะที่สุดมากสุด" value={fin.kpi.topCrop} hint={`${fin.kpi.topCropPct}% ของพื้นที่`} />
        <Kpi icon={TriangleAlert} tone="warn" label="ไม่เหมาะกับพืชใดเลย" value={`${fin.kpi.noCropPct}%`} hint="คะแนนสูงสุด < 0.4" />
        <Kpi icon={ChartColumn} tone="water" label="ความคลาดเคลื่อนโมเดล (MAE)" value={m.mae} hint={`ค่าเดา = ${m.baselineMae}`} />
        <Kpi icon={Target} tone="sun" label="Top-3 ถูกต้อง" value={`${Math.round(m.top3 * 100)}%`} hint="วัดเทียบกฎ" />
      </div>

      <div className="dash-grid">
        <section className="panel chart-panel" data-reveal>
          <div className="chart-heading"><h3>พืชที่เหมาะที่สุด แยกตามสัดส่วนพื้นที่</h3></div>
          <BarList rows={fin.bestCropArea} valueKey="pct" labelKey="crop" muted={(r) => r.id === 'none'} />
          <p className="chart-note">นับพื้นที่ที่พืชนั้น "ชนะ" พืชอื่นและได้คะแนน ≥ 0.4 · 0% = ไม่เคยเป็นพืชที่ดีที่สุดในพื้นที่ใด ไม่ได้แปลว่าปลูกไม่ได้</p>
        </section>
        <section className="panel chart-panel" data-reveal>
          <div className="chart-heading"><h3>พื้นที่ที่ “เหมาะ” (คะแนน ≥ 0.6)</h3></div>
          <BarList rows={fin.suitableShare} valueKey="pct" labelKey="crop" muted={(r) => !r.judgeable} display={(r) => (r.judgeable ? null : 'ตัดสินไม่ได้')} />
          <p className="chart-note">พืชสีจาง (ลำไย อ้อย กาแฟ) ตามกฎที่ใช้ ไม่มีแปลงใดผ่านเกณฑ์ จึง "ตัดสินไม่ได้" ไม่ได้แปลว่าลำปางปลูกไม่ได้</p>
        </section>
      </div>

      <section className="panel chart-panel" data-reveal>
        <div className="chart-heading"><h3>คะแนนเฉลี่ยอำเภอ × พืช</h3></div>
        <Heatmap rows={fin.heat.amphoes} cols={fin.heat.crops} matrix={fin.heat.matrix} />
        <p className="chart-note">ถ่วงน้ำหนักด้วยพื้นที่ · ยิ่งเขียวเข้มยิ่งเหมาะ (0–1)</p>
      </section>

      <section className="panel chart-panel" data-reveal>
        <div className="chart-heading"><h3>10 ตำบลที่เหมาะที่สุดสำหรับพืชที่เลือก</h3></div>
        <div className="dash-filters">
          <label className="field"><span>พืช</span>
            <select value={crop} onChange={(e) => setCrop(e.target.value)}>{fin.crops.map((c) => <option key={c.id}>{c.name}</option>)}</select></label>
          <label className="field"><span>อำเภอ</span>
            <select value={amphoe} onChange={(e) => setAmphoe(e.target.value)}><option>ทั้งหมด</option>{fin.heat.amphoes.map((a) => <option key={a}>{a}</option>)}</select></label>
        </div>
        {!judge && <p className="chart-note">พืชนี้ไม่มีพื้นที่ผ่านเกณฑ์ในกฎเดิม คะแนนจึงต่ำทั้งจังหวัด ใช้เทียบกันเองได้เท่านั้น</p>}
        <BarList key={`${crop}-${amphoe}`} rows={ranking} valueKey="v" labelKey="label" suffix="" max={100} />
        <p className="chart-note">คะแนนเฉลี่ยถ่วงพื้นที่ของตำบล (0–100)</p>
      </section>

    </>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [stage, setStage] = useState('eda');
  const [attempt, setAttempt] = useState(0);
  const stageRef = useRef(null);
  // เลือกขั้นตอนแล้วเลื่อนลงไปที่เนื้อหาของขั้นตอนนั้นทันที
  const chooseStage = (s) => {
    setStage(s);
    requestAnimationFrame(() => stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  useEffect(() => { setErr(''); loadDashboard().then(setData).catch((e) => setErr(e.message)); }, [attempt]);
  return (
    <>
      <PageIntro eyebrow="Dashboard" title="จากข้อมูลดิน สู่คำแนะนำพืช" image={IMAGES.aerial}
        description="สองส่วนตามโจทย์: 1) EDA process สำรวจและกรองข้อมูล 2) Final Dashboard ผลจากโมเดล ทุกตัวเลขคำนวณจากข้อมูลจริงของลำปาง" />
      <div className="wrap dashboard-wrap">
        <Pipeline stage={stage} onStage={chooseStage} data={data} />
        {err && <div className="panel"><EmptyState tone="error" icon={TriangleAlert} title="โหลดข้อมูลไม่สำเร็จ" description={`${err} (ตรวจว่ารัน backend อยู่)`} action={<button type="button" className="btn btn-o btn-sm" onClick={() => setAttempt((n) => n + 1)}><RefreshCw aria-hidden="true" />ลองอีกครั้ง</button>} /></div>}
        {!data && !err && <div role="status" aria-label="กำลังคำนวณข้อมูลจากโมเดล"><div className="dashboard-kpis four">{[0, 1, 2, 3].map((i) => <div className="kpi" key={i}><span className="skeleton" style={{ height: 14, width: '60%' }} /><span className="skeleton" style={{ height: 30, width: '45%', marginTop: 8 }} /></div>)}</div><SkeletonCards count={2} h={220} /></div>}
        <div ref={stageRef} className="stage-anchor" aria-hidden="true" />
        {data && <div className="stage-panel" key={stage}>{stage === 'eda' ? <EdaPart eda={data.eda} /> : <FinalPart fin={data.final} />}</div>}
      </div>
    </>
  );
}
