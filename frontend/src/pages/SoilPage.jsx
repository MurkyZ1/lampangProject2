import {useEffect,useMemo,useState} from 'react';
import {loadModelOptions,predictCrops} from '../services/modelService';
import { ArrowRight, CircleCheck, CloudRain, FlaskConical, Info, Layers, MessageCircle, Microscope, Mountain, ScanSearch, Sprout, TriangleAlert, Wrench } from 'lucide-react';
import PageIntro from '../components/PageIntro';
import Photo from '../components/ui/Photo';
import { SkeletonCards } from '../components/ui/Skeleton';
import { CROP_IMAGES, IMAGES, soilImageFor } from '../data/images';
import {CROP_GUIDE} from '../data/cropGuide';
const uniq=(a)=>[...new Set(a.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
function evaluate(crop,ph,drainage){
  const n=Number(ph);const hasPH=ph!==''&&Number.isFinite(n);
  const phOK=hasPH&&n>=crop.ph[0]&&n<=crop.ph[1];
  const poor=/แฉะ|ขัง|ไม่ดี|เลว|poor/i.test(drainage);
  const waterCrop=crop.id==='rice';
  if(!hasPH)return {state:'need',label:'ต้องตรวจเพิ่ม',note:'ระบุค่า pH เพื่อเริ่มคัดกรอง'};
  if(!phOK)return {state:'adjust',label:'ควรปรับปรุงดิน',note:`ค่า pH ${n} อยู่นอกช่วงทั่วไป ${crop.ph[0]}–${crop.ph[1]}`};
  if(poor&&!waterCrop)return {state:'adjust',label:'ต้องจัดการน้ำ',note:'ดินระบายน้ำไม่ดี ต้องประเมินระบบระบายน้ำก่อนปลูก'};
  return {state:'fit',label:'ผ่านเกณฑ์ pH เบื้องต้น',note:'ควรตรวจชนิดดิน น้ำ อากาศ และธาตุอาหารก่อนเลือกปลูก'};
}
const DRAIN_MAP={'ดี':'ดี','ปานกลาง':'ปานกลาง','ระบายน้ำเร็ว':'ดี','ไม่ดี / มีน้ำขัง':'ไม่ดี'};
const toTexture=(t,list)=>{const x=String(t||'').replace(/^ดิน/,'');return list.includes(x)?x:undefined;};
const num=(v)=>v===''||v==null||!Number.isFinite(Number(v))?undefined:Number(v);
const suitClass=(r)=>r.suitable===true?'fit':r.suitable===false&&r.score>=0.3?'adjust':'need';
export default function SoilPage({tambons,status,onNavigate,onOpenChat}){
  const [province,setProvince]=useState('');const [district,setDistrict]=useState('');const [tambon,setTambon]=useState('');
  const [ph,setPh]=useState('');const [texture,setTexture]=useState('');const [drainage,setDrainage]=useState('');const [water,setWater]=useState('');
  const [submitted,setSubmitted]=useState(false);
  const [opts,setOpts]=useState(null);const [amphoe,setAmphoe]=useState('');const [slope,setSlope]=useState('');const [depth,setDepth]=useState('');const [fert,setFert]=useState('');
  const [model,setModel]=useState(null);const [modelErr,setModelErr]=useState('');const [loading,setLoading]=useState(false);
  useEffect(()=>{loadModelOptions().then(setOpts).catch(()=>setOpts(null));},[]);
  const runModel=async()=>{
    setLoading(true);setModelErr('');
    try{
      const body={ph:num(ph),slope_pct:num(slope),depth_cm:num(depth),drainage:DRAIN_MAP[drainage],fertility:fert||undefined,texture:opts?toTexture(texture,opts.texture):undefined,amphoe:amphoe||undefined};
      setModel(await predictCrops(body));
    }catch(e){setModel(null);setModelErr(e.message);}
    finally{setLoading(false);}
  };
  const provinces=useMemo(()=>uniq(tambons.map(t=>t.province)),[tambons]);
  const districts=useMemo(()=>uniq(tambons.filter(t=>!province||t.province===province).map(t=>t.district)),[tambons,province]);
  const matches=useMemo(()=>tambons.filter(t=>(!province||t.province===province)&&(!district||t.district===district)),[tambons,province,district]);
  const selectLocation=(key)=>{
    const t=matches.find(x=>x.id===key);setTambon(key);
    if(t){const p=Number(t.ph);setPh(t.ph!==''&&Number.isFinite(p)&&p>=0&&p<=14?String(t.ph):'');setTexture(t.soilType);setDrainage(t.drainage);setWater(t.water);setSubmitted(false);}
  };
  const results=useMemo(()=>CROP_GUIDE.map(c=>({...c,result:evaluate(c,ph,drainage)})).sort((a,b)=>({fit:0,adjust:1,need:2}[a.result.state]-{fit:0,adjust:1,need:2}[b.result.state])),[ph,drainage]);
  const ready=ph!==''&&Number(ph)>=0&&Number(ph)<=14;
  const phNum=Number(ph);const phPos=ready?`${Math.min(100,Math.max(0,phNum/14*100))}%`:null;
  const phLabel=!ready?'':phNum<5.5?'ค่อนข้างเป็นกรด':phNum<=7.5?'ใกล้เป็นกลาง':'ค่อนข้างเป็นด่าง';
  const STATE_ICON={fit:CircleCheck,adjust:Wrench,need:Info};
  const soilImg=soilImageFor(texture);
  return <>
    <PageIntro eyebrow="01 / วิเคราะห์สภาพดิน" title="ดินแบบนี้ ปลูกอะไรได้บ้าง?" description="ใส่ค่าดินจากผลตรวจ หรือเลือกตำบลที่มีข้อมูล เพื่อคัดกรองพืชจากค่า pH และการระบายน้ำในเบื้องต้น" image={IMAGES.soilHands} aside={<span className="source-badge"><Microscope aria-hidden="true"/>โมเดลเรียนกฎ EcoCrop/LDD · ไม่ใช่ผลผลิตจริง</span>}/>
    <section className="wrap page-content">
      <div className="soil-layout">
        <form className="panel soil-form" onSubmit={e=>{e.preventDefault();setSubmitted(true);runModel();requestAnimationFrame(()=>document.getElementById('soil-results')?.scrollIntoView({behavior:'smooth',block:'start'}));}}>
          <div className="panel-title"><span className="panel-kicker">ข้อมูลของแปลง</span><h2>ระบุคุณสมบัติดิน</h2><p>กรอกเฉพาะข้อมูลที่ทราบ โดยค่าวิเคราะห์ดินจริงมีความแม่นยำกว่าข้อมูลภาพรวม</p></div>
          <fieldset className="form-group">
            <legend><span className="form-step">1</span>เลือกพื้นที่ (ไม่บังคับ)</legend>
            <div className="field-grid">
              <label className="field"><span>จังหวัดจาก Data</span><select value={province} onChange={e=>{setProvince(e.target.value);setDistrict('');setTambon('');setSubmitted(false);}}><option value="">{provinces.length?'เลือกจังหวัด':'ยังไม่มีข้อมูลตำบล'}</option>{provinces.map(x=><option key={x}>{x}</option>)}</select></label>
              <label className="field"><span>อำเภอ</span><select value={district} onChange={e=>{setDistrict(e.target.value);setTambon('');setSubmitted(false);}}><option value="">เลือกอำเภอ</option>{districts.map(x=><option key={x}>{x}</option>)}</select></label>
              <label className="field field-full"><span>ตำบล (ใช้ค่าดินที่มีในข้อมูล)</span><select value={tambon} onChange={e=>selectLocation(e.target.value)}><option value="">เลือกตำบล หรือกรอกค่าเองด้านล่าง</option>{matches.map(x=><option key={x.id} value={x.id}>{x.tambon}</option>)}</select></label>
            </div>
          </fieldset>
          <fieldset className="form-group">
            <legend><span className="form-step">2</span>คุณสมบัติดิน</legend>
            <div className="field-grid">
              <label className="field field-full"><span>ค่า pH ดิน <b>*</b><i className="info-tip" tabIndex={0} data-tip="มีผลต่อความพร้อมใช้ของธาตุอาหาร แต่ไม่ใช่ตัวชี้วัดเดียว"><Info aria-hidden="true"/></i></span>
                <div className="ph-input"><input required type="number" min="0" max="14" step="0.1" placeholder="เช่น 6.2" value={ph} onChange={e=>{setPh(e.target.value);setSubmitted(false);}}/>
                  <div className="ph-gauge" aria-hidden="true"><div className="ph-gauge-bar">{phPos&&<i style={{left:phPos}}/>}</div><div className="ph-gauge-labels"><span>กรด</span><span>7 กลาง</span><span>ด่าง</span></div></div>
                </div>
                {ready&&<small className="field-hint">ค่า {ph} · {phLabel}</small>}
                <small className="field-error">กรุณาระบุค่า pH ระหว่าง 0–14</small>
              </label>
              <div className="field field-full soil-texture-field">
                <label className="field"><span>เนื้อดิน / ชนิดดิน</span><select value={texture} onChange={e=>setTexture(e.target.value)}><option value="">ไม่ทราบ / ยังไม่ได้ตรวจ</option>{uniq(['ดินร่วน','ดินร่วนปนทราย','ดินร่วนเหนียว','ดินเหนียว','ดินทราย',texture]).map(x=><option key={x}>{x}</option>)}</select></label>
                <figure className="soil-preview" key={soilImg.file}><Photo img={soilImg} className="soil-preview-img" width={500}/><figcaption>ภาพประกอบลักษณะเนื้อดิน{texture?` · ${texture}`:''}</figcaption></figure>
              </div>
              <label className="field"><span>การระบายน้ำ</span><select value={drainage} onChange={e=>{setDrainage(e.target.value);setSubmitted(false);}}><option value="">ไม่ทราบ</option>{uniq(['ดี','ปานกลาง','ระบายน้ำเร็ว','ไม่ดี / มีน้ำขัง',drainage]).map(x=><option key={x}>{x}</option>)}</select></label>
              <label className="field"><span>ความอุดมสมบูรณ์</span><select value={fert} onChange={e=>{setFert(e.target.value);setSubmitted(false);}}><option value="">ไม่ทราบ</option>{(opts?.fertility||['ต่ำ','กลาง','สูง']).map(x=><option key={x}>{x}</option>)}</select></label>
              <label className="field"><span>ความลาดชัน (%)</span><input type="number" min="0" max="100" step="0.5" placeholder="เช่น 5" value={slope} onChange={e=>{setSlope(e.target.value);setSubmitted(false);}}/></label>
              <label className="field"><span>ความลึกดิน (ซม.)</span><input type="number" min="0" max="300" step="5" placeholder="เช่น 100" value={depth} onChange={e=>{setDepth(e.target.value);setSubmitted(false);}}/></label>
            </div>
          </fieldset>
          <fieldset className="form-group">
            <legend><span className="form-step">3</span>น้ำและภูมิอากาศ</legend>
            <div className="field-grid">
              <label className="field"><span>อำเภอ (ใช้ค่าฝนของโมเดล)</span><select value={amphoe} onChange={e=>{setAmphoe(e.target.value);setSubmitted(false);}}><option value="">ไม่ระบุ (ใช้ค่ากลางลำปาง)</option>{(opts?.amphoe||[]).map(x=><option key={x}>{x}</option>)}</select></label>
              <label className="field"><span>แหล่งน้ำ</span><input value={water} onChange={e=>setWater(e.target.value)} placeholder="เช่น น้ำฝน / ชลประทาน" maxLength={120}/></label>
            </div>
          </fieldset>
          <div className="form-foot"><button type="submit" className={`btn btn-g btn-lg ${loading?'is-loading':''}`} disabled={loading}><ScanSearch aria-hidden="true"/>ประเมินสภาพดิน</button><p><Layers aria-hidden="true"/>ข้อมูลตำบล: {status.tambons}</p></div>
        </form>
        <div className="soil-aside">
          <div className="panel soil-guide"><span className="panel-kicker">อ่านค่าให้เข้าใจ</span><h2>ปัจจัยที่ต้องดูร่วมกัน</h2>
            <div className="info-steps">
              <div><span className="info-step-icon tone-green"><FlaskConical aria-hidden="true"/></span><div><strong>ความเป็นกรด–ด่าง (pH)</strong><p>มีผลต่อความพร้อมใช้ของธาตุอาหาร แต่ไม่ใช่ตัวชี้วัดเดียว</p></div></div>
              <div><span className="info-step-icon tone-soil"><Layers aria-hidden="true"/></span><div><strong>ชนิดดินและการระบายน้ำ</strong><p>ดินโปร่งเหมาะพืชบางชนิด ดินกักน้ำได้เหมาะการทำนา</p></div></div>
              <div><span className="info-step-icon tone-water"><CloudRain aria-hidden="true"/></span><div><strong>น้ำและภูมิอากาศ</strong><p>ต้องตรวจฝน แหล่งน้ำ อุณหภูมิและฤดูกาลของพื้นที่จริง</p></div></div>
              <div><span className="info-step-icon tone-sun"><Mountain aria-hidden="true"/></span><div><strong>ธาตุอาหารและพื้นที่</strong><p>ตรวจ N-P-K อินทรียวัตถุ ความลาดชัน และประวัติแปลงก่อนลงทุน</p></div></div>
            </div>
            <div className="notice"><Info aria-hidden="true"/><span>การประเมินหน้านี้เป็นการกรองข้อมูลเบื้องต้น ไม่ใช่การวินิจฉัยดินหรือผลวิเคราะห์ห้องปฏิบัติการ</span></div>
            <button type="button" className="btn btn-o soil-chat-btn" onClick={onOpenChat}><MessageCircle aria-hidden="true"/>ถามคำถามเพิ่มเติมผ่านแชต</button>
          </div>
        </div>
      </div>

      <div className="section-subhead" id="soil-results"><div><span className="panel-kicker">ผลการคัดกรอง</span><h2>พืชและข้อควรพิจารณา</h2></div><span className="subtle">{submitted&&ready?`จากค่า pH ${ph}`:'กรอกค่า pH แล้วกดประเมิน'}</span></div>
      {submitted&&ready&&(loading?<div className="result-loading" role="status"><p className="subtle"><span className="spinner" aria-hidden="true"/>กำลังให้โมเดลประเมิน…</p><SkeletonCards count={4} h={90}/></div>:modelErr?<div className="alert alert--error" role="alert"><TriangleAlert aria-hidden="true"/><span>เรียกโมเดลไม่ได้: {modelErr} · แสดงผลคัดกรอง pH เบื้องต้นด้านล่างแทน (ตรวจว่าเปิด backend Python พอร์ต 8000 แล้ว)</span></div>:model&&<div className="model-result fade-in">
        <div className="model-head"><div><span className="panel-kicker">ผลจากโมเดล</span><h2>{model.message}</h2></div><span className="badge badge--muted">{model.confidenceNote}</span></div>
        <div className="crop-result-grid">{model.recommendations.map((r,i)=><article className={`result-card result-card--model is-${suitClass(r)}`} key={r.id} style={{'--i':i}}>
          <Photo img={CROP_IMAGES[r.id]} className="result-img" alt="" width={500}/>
          <div className="result-body">
            <div className="result-top"><span className="result-rank">#{i+1}</span><span className={`result-pill ${suitClass(r)}`}>{r.suitable===null?'ดูอันดับอย่างเดียว':r.label}</span></div>
            <h3>{r.crop}</h3>
            <div className="score"><div className="score-bar"><i style={{width:`${Math.max(0,Math.min(1,r.score))*100}%`}}/></div><span>คะแนน {r.score.toFixed(2)} / 1.00</span></div>
            {r.note&&<p>{r.note}</p>}
            <button type="button" className="text-action" onClick={()=>onNavigate('/crops',r.id)}>ดูวิธีปลูก <ArrowRight aria-hidden="true"/></button>
          </div>
        </article>)}</div>
        <div className="notice"><Info aria-hidden="true"/><span>{model.caveat}{model.assumedFeatures?.length>0&&` · ช่องที่ไม่ได้กรอกใช้ค่ากลางของลำปาง ${model.assumedFeatures.length} ตัวแปร`}</span></div>
      </div>)}
      {!submitted||!ready?<div className="panel hint-panel"><span className="hint-icon" aria-hidden="true"><Sprout/></span><p>กรอกข้อมูลดินและกด “ประเมินสภาพดิน” เพื่อดูผลสำหรับพืชแต่ละชนิด</p></div>:
        <><div className="section-subhead section-subhead--sm"><div><span className="panel-kicker">คัดกรองจากค่า pH และการระบายน้ำ</span><h3>เทียบกับคู่มือพืชทั่วไป</h3></div></div>
        <div className="crop-result-grid">{results.map((c,i)=>{const Icon=STATE_ICON[c.result.state];return <article className={`result-card is-${c.result.state}`} key={c.id} style={{'--i':i}}>
          <Photo img={CROP_IMAGES[c.id]} className="result-img" alt="" width={500}/>
          <div className="result-body">
            <div className="result-top"><span className={`result-pill ${c.result.state}`}><Icon aria-hidden="true"/>{c.result.label}</span></div>
            <h3>{c.name}</h3>
            <div className="ph-range" aria-label={`ค่า pH ทั่วไป ${c.ph[0]} ถึง ${c.ph[1]}`}><div className="ph-range-bar"><i style={{left:`${c.ph[0]/14*100}%`,width:`${(c.ph[1]-c.ph[0])/14*100}%`}}/>{phPos&&<b style={{left:phPos}}/>}</div><span>ค่า pH ทั่วไป: {c.ph[0]}–{c.ph[1]}</span></div>
            <p>{c.result.note}</p>
            <button type="button" className="text-action" onClick={()=>onNavigate('/crops',c.id)}>ดูวิธีปลูก <ArrowRight aria-hidden="true"/></button>
          </div>
        </article>;})}</div></>}
    </section>
  </>;
}
