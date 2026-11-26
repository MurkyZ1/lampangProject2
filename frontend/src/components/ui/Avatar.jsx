import { useState } from 'react';
import { UserRound } from 'lucide-react';

/** รูปโปรไฟล์: ใช้รูปจากบัญชีถ้ามี ถ้าไม่มี/โหลดไม่ได้ แสดง Default Avatar */
export default function Avatar({ src, name = '', size = 40, className = '' }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (src && !failed) {
    return <span className={`avatar ${className}`} style={style}><img src={src} alt="" onError={() => setFailed(true)} loading="lazy" decoding="async" /></span>;
  }
  return <span className={`avatar avatar--default ${className}`} style={style} aria-hidden="true"><UserRound style={{ width: '58%', height: '58%' }} /></span>;
}
