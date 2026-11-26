import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

/** แกลเลอรีรูปของรายงาน + Lightbox (กดดูรูปใหญ่, เลื่อนซ้าย/ขวา, Esc ปิด) */
export default function ReportGallery({ images = [], size = 'md', label = 'รูปประกอบรายงาน' }) {
  const [open, setOpen] = useState(-1);
  const close = useCallback(() => setOpen(-1), []);
  const step = useCallback(d => setOpen(i => (i + d + images.length) % images.length), [images.length]);
  useEffect(() => {
    if (open < 0) return undefined;
    const onKey = e => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('menu-open');
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('menu-open'); };
  }, [open, close, step]);
  if (!images.length) return null;
  const n = Math.min(images.length, 3);
  return <>
    <div className={`gallery gallery--${size} n${n}`}>
      {images.map((src, i) => <button type="button" key={src} onClick={() => setOpen(i)} aria-label={`ดูรูปที่ ${i + 1} จาก ${images.length} ขนาดใหญ่`}>
        <img src={src} alt={`${label} ${i + 1}`} loading="lazy" decoding="async" />
      </button>)}
    </div>
    {open >= 0 && createPortal(<div className="lightbox" role="dialog" aria-modal="true" aria-label={label} onClick={close}>
      <figure onClick={e => e.stopPropagation()}>
        <img key={images[open]} src={images[open]} alt={`${label} ${open + 1}`} />
        {images.length > 1 && <figcaption>{open + 1} / {images.length}</figcaption>}
      </figure>
      {images.length > 1 && <>
        <button type="button" className="lightbox-nav lightbox-nav--prev" onClick={e => { e.stopPropagation(); step(-1); }} aria-label="รูปก่อนหน้า"><ChevronLeft /></button>
        <button type="button" className="lightbox-nav lightbox-nav--next" onClick={e => { e.stopPropagation(); step(1); }} aria-label="รูปถัดไป"><ChevronRight /></button>
      </>}
      <button type="button" className="lightbox-close" autoFocus onClick={close} aria-label="ปิดรูป"><X /></button>
    </div>, document.body)}
  </>;
}
