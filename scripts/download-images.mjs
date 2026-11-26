/**
 * ดาวน์โหลดภาพถ่ายจริงที่ใช้ในหน้าเว็บมาเก็บไว้ใน frontend/public/images (WebP, บีบอัดแล้ว)
 * ภาพทั้งหมดมาจาก Unsplash (Unsplash License: ใช้ได้ฟรี ไม่ต้องแสดงเครดิต)
 * รันครั้งเดียวจากโฟลเดอร์หลัก:  npm run images:download
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { IMAGES, CROP_IMAGES, remoteSrc } from '../frontend/src/data/images.js';

const root = resolve(import.meta.dirname, '../frontend/public/images');
const all = [...Object.values(IMAGES), ...Object.values(CROP_IMAGES).map(img => ({ ...img, w: 900 }))];
const force = process.argv.includes('--force');
let ok = 0, skipped = 0, failed = 0;

for (const img of all) {
  const dest = resolve(root, img.file);
  if (!force) {
    try { if ((await stat(dest)).size > 1000) { skipped++; continue; } } catch { /* not downloaded yet */ }
  }
  try {
    const res = await fetch(remoteSrc(img), { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw new Error(`ไม่ใช่ไฟล์ภาพ (${type})`);
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    ok++;
    console.log(`✓ ${img.file} (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (error) {
    failed++;
    console.error(`✗ ${img.file}: ${error.message}`);
  }
}
console.log(`\nดาวน์โหลดใหม่ ${ok} · มีอยู่แล้ว ${skipped} · ไม่สำเร็จ ${failed}`);
if (failed) {
  console.log('ภาพที่ยังไม่มีในเครื่อง หน้าเว็บจะโหลดจาก CDN แทนชั่วคราว ลองรันคำสั่งนี้อีกครั้งเมื่อมีอินเทอร์เน็ต');
  process.exitCode = 1;
}
