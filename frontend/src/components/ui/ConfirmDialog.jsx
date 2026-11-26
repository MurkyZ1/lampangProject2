import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** กล่องยืนยัน ตกลง / ยกเลิก (Esc หรือคลิกพื้นหลัง = ยกเลิก) */
export default function ConfirmDialog({ open, icon: Icon, title, message, confirmText = 'ตกลง', cancelText = 'ยกเลิก', tone = 'primary', busy = false, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    cancelRef.current?.focus();
    const onKey = e => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Tab') { // วนโฟกัสอยู่ในกล่อง
        const els = [...document.querySelectorAll('.confirm-box button:not(:disabled)')];
        if (!els.length) return;
        const i = els.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); els[els.length - 1].focus(); }
        else if (!e.shiftKey && i === els.length - 1) { e.preventDefault(); els[0].focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onCancel]);
  if (!open) return null;
  return createPortal(<div className="confirm-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
    <div className="confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg">
      {Icon && <span className={`confirm-icon confirm-icon--${tone}`} aria-hidden="true"><Icon /></span>}
      <h2 id="confirm-title">{title}</h2>
      {message && <p id="confirm-msg">{message}</p>}
      <div className="confirm-actions">
        <button type="button" ref={cancelRef} className="btn btn-o" onClick={onCancel} disabled={busy}>{cancelText}</button>
        <button type="button" className={`btn ${tone === 'danger' ? 'btn-danger-solid' : 'btn-g'} ${busy ? 'is-loading' : ''}`} onClick={onConfirm} disabled={busy}>{confirmText}</button>
      </div>
    </div>
  </div>, document.body);
}
