import { useEffect, useMemo, useState } from 'react';
import PageIntro from '../components/PageIntro';
import EmptyState from '../components/EmptyState';
import { BarList, Heatmap, Histogram, Kpi, fmt } from '../components/charts';
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
      <div className="pipe-box">
        <b>แหล่งข้อมูล</b>
        {src.map((s) => <span key={s.name} title={s.detail}>{s.name}</span>)}
      </div>
      <span className="pipe-arrow">→</span>
      <button className={`pipe-box pipe-btn${stage === 'eda' ? ' on' : ''}`} onClick={() => onStage('eda')}>
        <b>1 · EDA process</b><span>สำรวจ · กรอง · ทำความสะอาด</span>
      </button>
      <span className="pipe-arrow">→</span>
      <button className={`pipe-box pipe-btn${stage === 'final' ? ' on' : ''}`} onClick={() => onStage('final')}>
        <b>2 · Final Dashboard</b><span>ผลจากโมเดล ML</span>
      </button>
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
        <Kpi label="แปลงดิน" value={fmt(o.rows)} hint={`${o.tambons} ตำบล · ${o.amphoes} อำเภอ`} />
        <Kpi label="พื้นที่รวม" value={`${(o.areaRai / 1e6).toFixed(2)} ล้านไร่`} />
        <Kpi label="ตัวแปรที่ใช้เรียน" value={o.featuresUsed} hint="หลังกรองแล้ว" />
        <Kpi label="พืชที่ประเมิน" value={o.crops} />
      </div>

      <div>
        <section className="panel chart-panel">
          <div className="chart-heading"><h3>การกระจายของตัวแปร</h3></div>
          <div className="filter-pills">
            {eda.distributions.map((x) => (
              <button key={x.key} className={`filter-pill${dist === x.key ? ' selected' : ''}`} onClick={() => setDist(x.key)}>{x.label}</button>
            ))}
          </div>
          <p className="hist-intro"><b>{info.name}</b> — {info.what}</p>
          <Histogram bins={d.bins} xTitle={info.x} />
          <p className="chart-note">อ่านกราฟ: แท่งยิ่งสูง = มีแปลงดินที่ค่านั้นมาก · ตัวเลขบนแท่งคือจำนวนแปลง และ % ของแปลงทั้งหมด · {top}</p>
        </section>

      </div>

      <section className="panel chart-panel">
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
      <div className="notice caveat" role="note">⚠ {fin.caveat}</div>
      <div className="dashboard-kpis four">
        <Kpi label="พืชที่เหมาะที่สุดมากสุด" value={fin.kpi.topCrop} hint={`${fin.kpi.topCropPct}% ของพื้นที่`} />
        <Kpi label="ไม่เหมาะกับพืชใดเลย" value={`${fin.kpi.noCropPct}%`} hint="คะแนนสูงสุด < 0.4" />
        <Kpi label="ความคลาดเคลื่อนโมเดล (MAE)" value={m.mae} hint={`ค่าเดา = ${m.baselineMae}`} />
        <Kpi label="Top-3 ถูกต้อง" value={`${Math.round(m.top3 * 100)}%`} hint="วัดเทียบกฎ" />
      </div>

      <div className="dash-grid">
        <section className="panel chart-panel">
          <div className="chart-heading"><h3>พืชที่เหมาะที่สุด แยกตามสัดส่วนพื้นที่</h3></div>
          <BarList rows={fin.bestCropArea} valueKey="pct" labelKey="crop" muted={(r) => r.id === 'none'} />
          <p className="chart-note">นับพื้นที่ที่พืชนั้น "ชนะ" พืชอื่นและได้คะแนน ≥ 0.4 · 0% = ไม่เคยเป็นพืชที่ดีที่สุดในพื้นที่ใด ไม่ได้แปลว่าปลูกไม่ได้</p>
        </section>
        <section className="panel chart-panel">
          <div className="chart-heading"><h3>พื้นที่ที่ “เหมาะ” (คะแนน ≥ 0.6)</h3></div>
          <BarList rows={fin.suitableShare} valueKey="pct" labelKey="crop" muted={(r) => !r.judgeable} display={(r) => (r.judgeable ? null : 'ตัดสินไม่ได้')} />
          <p className="chart-note">พืชสีจาง (ลำไย อ้อย กาแฟ) ตามกฎที่ใช้ ไม่มีแปลงใดผ่านเกณฑ์ จึง "ตัดสินไม่ได้" ไม่ได้แปลว่าลำปางปลูกไม่ได้</p>
        </section>
      </div>

      <section className="panel chart-panel">
        <div className="chart-heading"><h3>คะแนนเฉลี่ยอำเภอ × พืช</h3></div>
        <Heatmap rows={fin.heat.amphoes} cols={fin.heat.crops} matrix={fin.heat.matrix} />
        <p className="chart-note">ถ่วงน้ำหนักด้วยพื้นที่ · ยิ่งเขียวเข้มยิ่งเหมาะ (0–1)</p>
      </section>

      <section className="panel chart-panel">
        <div className="chart-heading"><h3>10 ตำบลที่เหมาะที่สุดสำหรับพืชที่เลือก</h3></div>
        <div className="dash-filters">
          <label className="field"><span>พืช</span>
            <select value={crop} onChange={(e) => setCrop(e.target.value)}>{fin.crops.map((c) => <option key={c.id}>{c.name}</option>)}</select></label>
          <label className="field"><span>อำเภอ</span>
            <select value={amphoe} onChange={(e) => setAmphoe(e.target.value)}><option>ทั้งหมด</option>{fin.heat.amphoes.map((a) => <option key={a}>{a}</option>)}</select></label>
        </div>
        {!judge && <p className="chart-note">พืชนี้ไม่มีพื้นที่ผ่านเกณฑ์ในกฎเดิม คะแนนจึงต่ำทั้งจังหวัด ใช้เทียบกันเองได้เท่านั้น</p>}
        <BarList rows={ranking} valueKey="v" labelKey="label" suffix="" max={100} />
        <p className="chart-note">คะแนนเฉลี่ยถ่วงพื้นที่ของตำบล (0–100)</p>
      </section>

    </>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [stage, setStage] = useState('eda');
  useEffect(() => { loadDashboard().then(setData).catch((e) => setErr(e.message)); }, []);
  return (
    <main>
      <PageIntro eyebrow="Dashboard" title="จากข้อมูลดิน สู่คำแนะนำพืช"
        description="สองส่วนตามโจทย์: 1) EDA process สำรวจและกรองข้อมูล 2) Final Dashboard ผลจากโมเดล ทุกตัวเลขคำนวณจากข้อมูลจริงของลำปาง" />
      <div className="wrap dashboard-wrap">
        <Pipeline stage={stage} onStage={setStage} data={data} />
        {err && <div className="data-error" role="alert">โหลดข้อมูลไม่สำเร็จ: {err} (ตรวจว่ารัน backend อยู่)</div>}
        {!data && !err && <EmptyState title="กำลังโหลด..." description="กำลังคำนวณข้อมูลจากโมเดล" />}
        {data && (stage === 'eda' ? <EdaPart eda={data.eda} /> : <FinalPart fin={data.final} />)}
      </div>
    </main>
  );
}