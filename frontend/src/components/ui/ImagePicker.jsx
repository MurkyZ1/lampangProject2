import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

const MAX_SIDE = 1600;
const MAX_INPUT = 15 * 1024 * 1024;

/**
 * ย่อรูปในเบราว์เซอร์ก่อนส่ง: ด้านยาวไม่เกิน 1600px แปลงเป็น JPEG
 * การวาดลง canvas ใหม่ทำให้ข้อมูล EXIF (รวมพิกัด GPS) ถูกตัดทิ้งไปด้วย
 */
async function compress(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  const img = bitmap || await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('อ่านไฟล์รูปไม่ได้'));
    el.src = URL.createObjectURL(file);
  });
  const w0 = img.width, h0 = img.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w0 * scale);
  canvas.height = Math.round(h0 * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  bitmap?.close?.();
  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > 1.9 * 1024 * 1024 * 1.37 && quality > 0.4) { quality -= 0.12; dataUrl = canvas.toDataURL('image/jpeg', quality); }
  return { dataUrl, name: file.name, kb: Math.round(dataUrl.length * 0.75 / 1024) };
}

export default function ImagePicker({ value, onChange, max = 3, onError }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  async function pick(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    const room = max - value.length;
    if (files.length > room) onError?.(`แนบรูปได้สูงสุด ${max} รูป`);
    setBusy(true);
    const next = [...value];
    for (const f of files.slice(0, Math.max(0, room))) {
      if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type) && !/\.(jpe?g|png|webp|heic)$/i.test(f.name)) { onError?.(`ไฟล์ ${f.name} ไม่ใช่รูปภาพ`); continue; }
      if (f.size > MAX_INPUT) { onError?.(`ไฟล์ ${f.name} ใหญ่เกิน 15 MB`); continue; }
      try { next.push(await compress(f)); } catch { onError?.(`อ่านไฟล์ ${f.name} ไม่ได้ ลองบันทึกเป็น JPG แล้วแนบใหม่`); }
    }
    onChange(next);
    setBusy(false);
  }
  return <div className="image-picker">
    <div className="image-picker-grid">
      {value.map((img, i) => <figure className="image-thumb" key={`${img.name}-${i}`}>
        <img src={img.dataUrl} alt={`รูปที่แนบ ${i + 1}`} />
        <button type="button" className="image-remove" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`ลบรูปที่ ${i + 1}`}><X /></button>
      </figure>)}
      {value.length < max && <button type="button" className={`image-add ${busy ? 'is-busy' : ''}`} onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
        <span>{busy ? 'กำลังย่อรูป…' : 'เพิ่มรูป'}</span>
      </button>}
    </div>
    <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple onChange={pick} aria-label="เลือกรูปที่จะแนบ" />
    <small className="field-hint">ไม่บังคับ · สูงสุด {max} รูป · ระบบย่อรูปและลบข้อมูลตำแหน่ง (GPS) ในไฟล์ก่อนส่ง</small>
  </div>;
}
