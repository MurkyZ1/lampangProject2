// รายการภาพถ่ายจริงที่ใช้ในเว็บไซต์ (Unsplash License: ใช้ได้ฟรี ไม่ต้องแสดงเครดิต)
// ไฟล์จริงเก็บใน frontend/public/images/** — ดาวน์โหลดครั้งเดียวด้วย `npm run images:download` จากโฟลเดอร์หลัก
// ถ้ายังไม่มีไฟล์ในเครื่อง คอมโพเนนต์ <Photo> จะโหลดภาพเดียวกันจาก CDN ของ Unsplash แทนชั่วคราว
// ภาพเป็นภาพประกอบชนิดพืช/ภูมิประเทศเท่านั้น ไม่ได้ถ่ายในจังหวัดลำปางและไม่ใช่ข้อมูลของพื้นที่

export const IMAGES = {
  hero:      { file: 'scenes/terraced-fields.webp', id: '1780715017688-a50312a5a249', alt: 'นาขั้นบันไดสีเขียวท่ามกลางภูเขา', w: 1920 },
  valley:    { file: 'scenes/farm-valley.webp',     id: '1520052203542-d3095f1b6cf0', alt: 'เกษตรกรทำงานในนาข้าวเชิงเขา', w: 1400 },
  terrace:   { file: 'scenes/rice-terrace-dawn.webp', id: '1609412058473-c199497c3c5d', alt: 'นาขั้นบันไดยามเช้า', w: 1400 },
  aerial:    { file: 'scenes/aerial-fields.webp',   id: '1762944084271-c64635a1f3b1', alt: 'มุมสูงของแปลงเกษตรบนเนินเขา', w: 1400 },
  farmer:    { file: 'scenes/farmer-planting.webp', id: '1505471768190-275e2ad7b3f9', alt: 'เกษตรกรสวมงอบกำลังปักดำต้นข้าว', w: 1200 },
  community: { file: 'scenes/farm-community.webp',  id: '1712474727361-e0fb5461086f', alt: 'ชาวบ้านทำงานร่วมกันในแปลงเกษตร', w: 1400 },
  paddy:     { file: 'scenes/paddy-closeup.webp',   id: '1761549850398-cd850cb5eb71', alt: 'ต้นข้าวเขียวในแปลงนา', w: 1400 },
  sprout:    { file: 'soil/sprouts.webp',           id: '1777144408400-ba9339876725', alt: 'ต้นกล้าเล็กงอกจากดิน', w: 1200 },
  soilHands: { file: 'soil/soil-in-hand.webp',      id: '1642952273588-ed6fa28870ac', alt: 'ดินร่วนในมือเกษตรกร', w: 1200 },
  soilLoam:  { file: 'soil/dark-loam.webp',         id: '1770583287085-135748e01164', alt: 'ดินร่วนสีเข้มที่มีอินทรียวัตถุ', w: 900 },
  soilClods: { file: 'soil/soil-clods.webp',        id: '1613036582025-ba1d4ccb3226', alt: 'หน้าดินที่มีก้อนดินและหินเล็ก', w: 900 },
  soilClay:  { file: 'soil/cracked-clay.webp',      id: '1519806390608-acf7ef9c8d1b', alt: 'หน้าดินเหนียวแห้งแตกระแหง', w: 900 },
  soilGravel:{ file: 'soil/gravelly-soil.webp',     id: '1774526380611-d056d8c946dc', alt: 'ดินแห้งที่มีกรวดปน', w: 900 },
};

// ภาพของพืชใน CROP_GUIDE (key = crop.id เดิม ไม่เพิ่มพืชใหม่)
export const CROP_IMAGES = {
  rice:      { file: 'crops/rice.webp',      id: '1728895604559-a4e16081504e', alt: 'รวงข้าวสีทองในแปลงนา' },
  maize:     { file: 'crops/maize.webp',     id: '1551810080-3eb3be72d3f4',    alt: 'ต้นข้าวโพดในแปลงปลูก' },
  cassava:   { file: 'crops/cassava.webp',   id: '1757283961570-682154747d9c', alt: 'หัวมันสำปะหลังที่เพิ่งขุด' },
  longan:    { file: 'crops/longan.webp',    id: '1794316124208-336d7fe4a342', alt: 'ช่อลำไยบนกิ่ง' },
  mango:     { file: 'crops/mango.webp',     id: '1782099542422-b2952aaaad4c', alt: 'ผลมะม่วงดิบบนต้น' },
  arabica:   { file: 'crops/arabica.webp',   id: '1677123617592-5c30e34f40e9', alt: 'ผลกาแฟสุกบนกิ่ง' },
  pineapple: { file: 'crops/pineapple.webp', id: '1723571495638-7f3fb5c18ee1', alt: 'ผลสับปะรดบนต้น' },
  garlic:    { file: 'crops/garlic.webp',    id: '1782853238616-6a6082aa0f52', alt: 'หัวกระเทียมสดพร้อมราก' },
  soybean:   { file: 'crops/soybean.webp',   id: '1601993488142-d3050a16478d', alt: 'เมล็ดถั่วเหลือง' },
  sugarcane: { file: 'crops/sugarcane.webp', id: '1794392410396-aab31138e8ea', alt: 'ไร่อ้อยริมทางเชิงเขา' },
};

// ภาพประกอบเนื้อดินตามชื่อที่ใช้ในฟอร์มเดิม (ภาพประกอบลักษณะทั่วไป ไม่ใช่ผลตรวจ)
export function soilImageFor(texture = '') {
  const t = String(texture);
  if (/เหนียว/.test(t) && !/ร่วน/.test(t)) return IMAGES.soilClay;
  if (/ทราย/.test(t) && !/ร่วน/.test(t)) return IMAGES.soilGravel;
  if (/ทราย/.test(t)) return IMAGES.soilClods;
  if (/ร่วน/.test(t)) return IMAGES.soilLoam;
  return IMAGES.soilHands;
}

export const localSrc = img => `/images/${img.file}`;
export const remoteSrc = (img, w = img.w || 900) => `https://images.unsplash.com/photo-${img.id}?w=${w}&q=70&fm=webp&fit=max`;
