import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';

const ToastContext = createContext(() => {});
const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };

/** Toast แจ้งเตือนมุมจอ ไม่ใช้ไลบรารีเพิ่ม */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const dismiss = useCallback(id => setItems(list => list.map(t => t.id === id ? { ...t, leaving: true } : t)), []);
  const remove = useCallback(id => setItems(list => list.filter(t => t.id !== id)), []);
  const push = useCallback((message, type = 'info') => {
    const id = ++seq.current;
    setItems(list => [...list.slice(-3), { id, message, type }]);
    window.setTimeout(() => dismiss(id), 4200);
  }, [dismiss]);
  const value = useMemo(() => push, [push]);
  return <ToastContext.Provider value={value}>
    {children}
    <div className="toast-stack" role="region" aria-label="การแจ้งเตือน" aria-live="polite">
      {items.map(t => {
        const Icon = ICONS[t.type] || Info;
        return <div key={t.id} className={`toast toast--${t.type} ${t.leaving ? 'is-leaving' : ''}`} onAnimationEnd={() => t.leaving && remove(t.id)}>
          <Icon aria-hidden="true" /><p>{t.message}</p>
          <button type="button" className="icon-btn icon-btn--sm" onClick={() => dismiss(t.id)} aria-label="ปิดการแจ้งเตือน"><X /></button>
        </div>;
      })}
    </div>
  </ToastContext.Provider>;
}

export const useToast = () => useContext(ToastContext);
