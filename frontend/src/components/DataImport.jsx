import {useRef,useState} from 'react';
import {FileDown,Upload} from 'lucide-react';
export default function DataImport({kind,onImport,compact=false}){
  const input=useRef(null);
  const [result,setResult]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function load(e){
    const file=e.target.files?.[0];if(!file)return;
    setBusy(true);setError('');setResult('');
    try{const r=await onImport(kind,file);setResult(`นำเข้าสำเร็จ ${r.count.toLocaleString('th-TH')} รายการ${r.invalid?` · ข้าม ${r.invalid} รายการที่ข้อมูลไม่ครบ`:''}`);}
    catch(err){setError(err.message||'อ่านไฟล์ไม่ได้');}
    finally{setBusy(false);e.target.value='';}
  }
  return <div className={`import-panel ${compact?'import-panel--compact':''}`}>
    <span className="import-icon" aria-hidden="true"><Upload/></span><div><strong>มี Data ของตัวเองแล้ว?</strong><p>นำเข้าไฟล์ CSV (UTF-8) หรือ JSON เพื่อแสดงข้อมูลจริงในหน้าเว็บนี้</p></div>
    <div className="import-actions">
      <input ref={input} className="sr-only" type="file" accept=".csv,.json,text/csv,application/json" onChange={load} aria-label="เลือกไฟล์ข้อมูล" />
      <button type="button" className={`btn btn-g btn-sm ${busy?'is-loading':''}`} disabled={busy} onClick={()=>input.current?.click()}><Upload aria-hidden="true"/>{busy?'กำลังนำเข้า…':'นำเข้าข้อมูล'}</button>
      <a href={`/templates/${kind==='tambons'?'tambons':'crop-stats'}-template.csv`} download className="link-btn"><FileDown aria-hidden="true"/>ตัวอย่างคอลัมน์</a>
    </div>
    {result&&<p role="status" className="feedback-success">{result}</p>}
    {error&&<p role="alert" className="feedback-error">{error}</p>}
  </div>;
}
