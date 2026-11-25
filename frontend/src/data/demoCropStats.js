// ข้อมูลสังเคราะห์เพื่อทดลอง UI เท่านั้น ห้ามใช้ตีความเป็นสถิติจริง
const provinces=['ลำปาง','เชียงใหม่','ลำพูน','แพร่'];
const crops=[['ข้าว',430,12000],['ข้าวโพด',710,8800],['มันสำปะหลัง',2750,7000]];
export const DEMO_CROP_STATS = [2024,2025].flatMap((year,yi)=>provinces.flatMap((province,pi)=>crops.map(([crop,yieldBase,baseArea],ci)=>{
  const areaRai=Math.round(baseArea*(1+0.12*pi+0.06*ci+0.04*yi));
  const yieldKgRai=Math.round(yieldBase*(0.92+0.035*pi+0.03*yi));
  return {province,district:'',tambon:'',year,crop,areaRai,yieldKgRai,productionTons:Math.round(areaRai*yieldKgRai/1000),source:'ข้อมูลสาธิตที่สร้างขึ้น (ไม่ใช่ข้อมูลราชการ)'};
})));
