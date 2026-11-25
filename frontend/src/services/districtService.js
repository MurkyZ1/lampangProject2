import { DEMO_DISTRICTS, DISTRICT_SHAPES } from '../data/districts';

const source = import.meta.env.VITE_DATA_SOURCE || 'mock';
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * DEMO: ใช้ข้อมูลรายอำเภอจากเว็บที่ผู้ใช้อัปโหลด (เป็นค่าประมาณ)
 * API : GET /api/districts ควรตอบ [{ code, zone, terrain, soil, ph, drain,
 *        temp, rain, water, crops, tip, ... }]
 * รูปแผนที่ SVG จะยังใช้ staticShapes ที่มากับ frontend
 */
export async function loadDistricts() {
  if (source !== 'api') return DEMO_DISTRICTS;

  const res = await fetch(`${base}/api/districts`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`โหลดข้อมูลอำเภอไม่สำเร็จ (${res.status})`);
  const payload = await res.json();
  const list = Array.isArray(payload) ? payload : payload.districts;
  if (!Array.isArray(list)) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง: ต้องมี districts array');

  const byCode = new Map(list.map((d) => [String(d.code), d]));
  return DISTRICT_SHAPES.map((shape) => ({ ...shape, ...(byCode.get(shape.code) || {}) }));
}

export const isDemoData = source !== 'api';
