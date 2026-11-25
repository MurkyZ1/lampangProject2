const mode = import.meta.env.VITE_CHAT_MODE || 'mock';
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const isDemoChat = mode !== 'api';

/**
 * POST /api/chat
 * Request: { message: string, districtCode: string | null, history: [{role, content}] }
 * Response: { reply: string } (หรือ { message: string })
 * API key ต้องเก็บใน backend เท่านั้น ห้ามใส่ไว้ในไฟล์ .env ที่ขึ้นต้น VITE_
 */
export async function getChatReply({ message, districtCode, history, districts }) {
  if (mode === 'api') {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, districtCode, history }),
    });
    if (!res.ok) throw new Error(`เชื่อมต่อผู้ช่วยไม่สำเร็จ (${res.status})`);
    const data = await res.json();
    const reply = data.reply || data.message;
    if (typeof reply !== 'string' || !reply.trim()) throw new Error('API ไม่ได้ส่งข้อความ reply กลับมา');
    return reply;
  }

  // ตอบจากข้อมูลตัวอย่างแบบ rule-based เพื่อให้หน้าแชตทดสอบได้ก่อนมี backend
  const focus = districts.find((d) => d.code === districtCode);
  const matches = districts.filter((d) => message.includes(d.th));
  const subject = focus || matches[0];
  await new Promise((resolve) => setTimeout(resolve, 450));

  if (subject) {
    const crops = Array.isArray(subject.crops) ? subject.crops.join(', ') : 'ยังไม่มีข้อมูล';
    return `**ตัวอย่างข้อมูลอำเภอ${subject.th}**\n- ลักษณะพื้นที่: ${subject.terrain || 'ยังไม่มีข้อมูล'}\n- สภาพดิน: ${subject.soil || 'ยังไม่มีข้อมูล'} (pH ${subject.ph || '—'})\n- พืชที่แนะนำ: ${crops}\n- ข้อควรพิจารณา: ${subject.tip || 'ควรตรวจสอบสภาพพื้นที่ก่อนปลูก'}\n\n*นี่เป็นคำตอบ DEMO จากข้อมูลในโปรเจกต์เดิม ยังไม่ใช่ AI จริง*`;
  }
  if (/กาแฟ|ที่สูง/.test(message)) {
    const high = districts.filter((d) => d.zone === 'highland');
    return `**ตัวอย่างคำตอบจากข้อมูลเดิม**\nอำเภอที่มีลักษณะเป็นพื้นที่สูง ได้แก่ ${high.map((d) => d.th).join(', ')}\n\nหากต้องการข้อมูลเฉพาะพื้นที่ กรุณาระบุชื่ออำเภอในคำถาม\n\n*แชตนี้เป็น DEMO ยังไม่ได้เชื่อมต่อ AI หรือ Backend จริง*`;
  }
  if (/แล้ง|น้ำน้อย|ขาดน้ำ/.test(message)) {
    return '**แนวทางเบื้องต้นในฤดูแล้ง (DEMO)**\n- เลือกพืชที่ใช้น้ำน้อยให้เหมาะกับพื้นที่จริง\n- ใช้วัสดุคลุมดินเพื่อลดการระเหย\n- ตรวจสอบแหล่งน้ำก่อนลงทุนปลูก\n\n*เมื่อเชื่อมต่อ backend ใหม่ จะนำข้อมูลของคุณมาทดแทนได้*';
  }
  return '**โหมดทดลองใช้งาน (DEMO)**\nตอนนี้เว็บไซต์แสดงตัวอย่างหน้าตาและการทำงานของแชตเท่านั้น ยังไม่มี AI หรือ Backend จริง\n\nลองพิมพ์ชื่ออำเภอในลำปาง พร้อมคำถามเรื่องดินหรือพืชที่เหมาะสมได้';
}
