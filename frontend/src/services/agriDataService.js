const apiBase=(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/,'');
const fromApi=import.meta.env.VITE_AGRI_SOURCE === 'api';
const paths={tambons:fromApi?`${apiBase}/api/tambons`:'/data/tambons.json',stats:fromApi?`${apiBase}/api/crop-stats`:'/data/crop-stats.json'};

const val=(row,...keys)=>{
  for(const key of keys){if(row[key]!==undefined && row[key]!==null && String(row[key]).trim()!=='')return row[key];}
  return '';
};
const number=(v)=>{
  const n=Number(String(v??'').replace(/,/g,'').trim());return v==null||String(v).trim()===''||!Number.isFinite(n)?null:n;
};
export const normalizeTambon=(r,i=0)=>({
  id:String(val(r,'id','code','tambon_code','รหัสตำบล') || `t-${i}`),
  province:String(val(r,'province','จังหวัด')||'ลำปาง').trim(),
  district:String(val(r,'district','amphoe','อำเภอ')).trim(),
  tambon:String(val(r,'tambon','subdistrict','ตำบล')).trim(),
  village:String(val(r,'village','community','หมู่บ้าน','ชุมชน')).trim(),
  mapX:number(val(r,'mapX','map_x')),mapY:number(val(r,'mapY','map_y')),
  mapPath:String(val(r,'mapPath','map_path')).trim(),
  soilType:String(val(r,'soilType','soil_type','soil','ชนิดดิน','สภาพดิน')).trim(),
  ph:String(val(r,'ph','pH','soil_ph','ค่า pH','ค่าพีเอช')).trim(),
  drainage:String(val(r,'drainage','drain','การระบายน้ำ')).trim(),
  water:String(val(r,'water','water_source','แหล่งน้ำ')).trim(),
  crops:String(val(r,'crops','recommended_crops','พืชที่เหมาะสม')).split(/[|;,，]/).map(v=>v.trim()).filter(Boolean),
  notes:String(val(r,'notes','recommendation','หมายเหตุ','คำแนะนำ')).trim(),
  source:String(val(r,'source','แหล่งข้อมูล')).trim(),
  updatedAt:String(val(r,'updatedAt','updated_at','วันที่อัปเดต')).trim(),
});
export const normalizeStat=(r)=>{
  const areaRai=number(val(r,'areaRai','area_rai','พื้นที่ปลูก(ไร่)','พื้นที่ปลูก'));
  const productionTons=number(val(r,'productionTons','production_tons','ผลผลิต(ตัน)','ผลผลิต'));
  const explicitYield=number(val(r,'yieldKgRai','yield_kg_rai','ผลผลิตต่อไร่','ผลผลิตต่อไร่(กก.)'));
  return {
    province:String(val(r,'province','จังหวัด')).trim(), district:String(val(r,'district','อำเภอ')).trim(),
    tambon:String(val(r,'tambon','ตำบล')).trim(), crop:String(val(r,'crop','พืช','ชนิดพืช')).trim(),
    year:String(val(r,'year','ปี','ปีเพาะปลูก')).trim(),areaRai,productionTons,
    yieldKgRai:explicitYield??(areaRai>0&&productionTons!=null?productionTons*1000/areaRai:null),
    source:String(val(r,'source','แหล่งข้อมูล')).trim(),
  };
};

function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
    }else if(ch===','&&!quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&text[i+1]==='\n')i++;
      row.push(cell);cell='';if(row.some(v=>v.trim()))rows.push(row);row=[];
    }else cell+=ch;
  }
  if(quoted)throw new Error('CSV มีเครื่องหมายคำพูดไม่ครบ');
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  if(!rows.length)return [];
  const headers=rows[0].map(v=>v.replace(/^\uFEFF/,'').trim());
  if(new Set(headers).size!==headers.length)throw new Error('หัวคอลัมน์ซ้ำกัน');
  return rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]||'').trim()])));
}
export async function readDatasetFile(file,kind){
  if(!file)throw new Error('กรุณาเลือกไฟล์');
  if(file.size>8*1024*1024)throw new Error('ไฟล์ใหญ่เกิน 8 MB กรุณาแบ่งไฟล์');
  const txt=(await file.text()).replace(/^\uFEFF/,'');
  let rows;
  if(file.name.toLowerCase().endsWith('.csv')) rows=parseCsv(txt);
  else if(file.name.toLowerCase().endsWith('.json')){
    const v=JSON.parse(txt);rows=Array.isArray(v)?v:(v[kind==='tambons'?'tambons':'stats']||v.data||v.records);
  } else throw new Error('รองรับเฉพาะไฟล์ CSV หรือ JSON (สำหรับ Excel ให้บันทึกเป็น CSV UTF-8)');
  if(!Array.isArray(rows))throw new Error('ไฟล์ต้องเป็น Array หรือมีคีย์ tambons / stats');
  const mapped=rows.map((r,i)=>kind==='tambons'?normalizeTambon(r,i):normalizeStat(r));
  const valid=mapped.filter(r=>kind==='tambons'?r.tambon&&r.district:r.province&&r.crop&&r.year);
  if(!valid.length)throw new Error(kind==='tambons'?'ไม่พบคอลัมน์ ตำบล และ อำเภอ':'ไม่พบคอลัมน์ จังหวัด พืช และ ปี');
  return {rows:valid,invalid:rows.length-valid.length};
}
export async function loadAgricultureDataset(kind){
  const res=await fetch(paths[kind],{headers:{Accept:'application/json'}});
  if(!res.ok)throw new Error(`โหลดข้อมูลไม่สำเร็จ (${res.status})`);
  const data=await res.json();
  const rows=Array.isArray(data)?data:(data[kind==='tambons'?'tambons':'stats']||data.data||[]);
  if(!Array.isArray(rows))throw new Error('ข้อมูล API ต้องเป็น Array');
  return rows.map((r,i)=>kind==='tambons'?normalizeTambon(r,i):normalizeStat(r)).filter(r=>kind==='tambons'?r.tambon&&r.district:r.province&&r.crop&&r.year);
}
