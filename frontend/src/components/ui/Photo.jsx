import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { localSrc, remoteSrc } from '../../data/images';

/**
 * ภาพถ่ายจริงจากรายการใน data/images.js
 * ลำดับการโหลด: ไฟล์ในโปรเจกต์ (/images/...) → CDN ของภาพเดียวกัน → พื้นหลังสำรอง
 */
export default function Photo({ img, className = '', eager = false, width, sizes, alt, ...rest }) {
  const [stage, setStage] = useState(0);
  if (!img || stage > 1) {
    return <span className={`photo photo--empty ${className}`} role={alt === '' ? undefined : 'img'} aria-label={alt ?? img?.alt ?? 'ภาพประกอบ'}><ImageOff aria-hidden="true" /></span>;
  }
  const src = stage === 0 ? localSrc(img) : remoteSrc(img, width);
  return <span className={`photo ${className}`}>
    <img
      src={src}
      alt={alt ?? img.alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : undefined}
      sizes={sizes}
      onError={() => setStage(s => s + 1)}
      onLoad={e => e.currentTarget.classList.add('is-loaded')}
      {...rest}
    />
  </span>;
}
