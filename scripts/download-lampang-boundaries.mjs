/** Download a licensed TopoJSON asset to serve from your own frontend. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const url = 'https://cdn.jsdelivr.net/gh/GeoThai/boundaries@v2026.10.23/datawrapper/subdistricts/52.topojson';
const dest = resolve(import.meta.dirname, '../frontend/public/data/lampang-subdistricts.topojson');
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  const value = JSON.parse(text);
  if (value.type !== 'Topology' || !value.objects || !value.arcs) throw new Error('Invalid TopoJSON');
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, text);
  console.log(`บันทึกแผนที่ลำปางไว้ที่ ${dest} (${(text.length/1024).toFixed(0)} KB)`);
  console.log('ที่มา: GeoThai, from OCHA COD-AB and Royal Thai Survey Department. License CC BY 3.0 IGO.');
} catch (error) {
  console.error('ดาวน์โหลดขอบเขตตำบลไม่สำเร็จ:', error.message);
  console.error('เปิดลิงก์นี้จากเบราว์เซอร์ แล้วบันทึกเป็น frontend/public/data/lampang-subdistricts.topojson:', url);
  process.exitCode = 1;
}
