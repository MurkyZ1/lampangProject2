const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
async function call(path, options) {
  const res = await fetch(`${base}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = j.error || (typeof j.detail === 'string' ? j.detail : ''); } catch { /* ignore */ }
    throw new Error(detail || `เชื่อมต่อโมเดลไม่สำเร็จ (${res.status})`);
  }
  return res.json();
}
/** POST /api/predict — ดิน/ฝน -> คะแนน 10 พืช */
export const predictCrops = (payload) => call('/api/predict', { method: 'POST', body: JSON.stringify(payload) });
/** GET /api/model/options — ตัวเลือกฟอร์ม (อำเภอ, การระบายน้ำ, ...) */
export const loadModelOptions = () => call('/api/model/options');

/** GET /api/dashboard — ข้อมูลหน้า Dashboard (eda + final) */
export const loadDashboard = () => call('/api/dashboard');
