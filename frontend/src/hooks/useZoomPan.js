import { useCallback, useEffect, useRef, useState } from 'react';

const MIN = 1;
const MAX = 6;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Zoom / Pan สำหรับ SVG (ไม่ใช้ไลบรารีเพิ่ม)
 * - ปุ่ม + / − / รีเซ็ต (เคลื่อนแบบนุ่มนวลด้วย CSS transition)
 * - Ctrl/⌘ + ล้อเมาส์ หรือ pinch บน trackpad
 * - ลากเพื่อเลื่อนเมื่อซูมแล้ว, ใช้สองนิ้ว pinch บนมือถือ
 * - คลิกพื้นที่ยังทำงานตามเดิม (การลากจะไม่ถูกนับเป็นคลิก)
 */
export default function useZoomPan({ width, height, resetKey }) {
  const svgRef = useRef(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [animating, setAnimating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hint, setHint] = useState(false);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const moved = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  const fit = useCallback(v => {
    const k = clamp(v.k, MIN, MAX);
    return { k, x: clamp(v.x, width * (1 - k), 0), y: clamp(v.y, height * (1 - k), 0) };
  }, [width, height]);

  const toSvg = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return { x: width / 2, y: height / 2 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, [width, height]);

  const zoomAt = useCallback((factor, center, animate = true) => {
    setAnimating(animate);
    setView(v => {
      const c = center || { x: width / 2, y: height / 2 };
      const k = clamp(v.k * factor, MIN, MAX);
      const r = k / v.k;
      return fit({ k, x: c.x - (c.x - v.x) * r, y: c.y - (c.y - v.y) * r });
    });
  }, [fit, width, height]);

  const reset = useCallback(() => { setAnimating(true); setView({ k: 1, x: 0, y: 0 }); }, []);
  useEffect(() => { setAnimating(false); setView({ k: 1, x: 0, y: 0 }); }, [resetKey]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    let hintTimer;
    const onWheel = e => {
      if (!(e.ctrlKey || e.metaKey)) {
        setHint(true);
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => setHint(false), 1400);
        return;
      }
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.0022), toSvg(e.clientX, e.clientY), false);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => { svg.removeEventListener('wheel', onWheel); clearTimeout(hintTimer); };
  }, [zoomAt, toSvg, resetKey]);

  const onPointerDown = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    const pts = [...pointers.current.values()];
    if (pts.length === 1) gesture.current = { type: 'pan', sx: e.clientX, sy: e.clientY, start: viewRef.current };
    if (pts.length === 2) {
      const [a, b] = pts;
      gesture.current = { type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), start: viewRef.current, center: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2) };
    }
  };

  const onPointerMove = e => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const ctm = svgRef.current?.getScreenCTM();
    const unit = ctm ? 1 / ctm.a : 1;
    if (g.type === 'pan') {
      const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
      if (!moved.current && Math.hypot(dx, dy) < 5) return;
      if (g.start.k <= 1) return; // ยังไม่ซูม: ไม่ต้องเลื่อนแผนที่ ปล่อยให้เลื่อนหน้าเว็บ/คลิกตามปกติ
      if (!moved.current) { moved.current = true; setDragging(true); setAnimating(false); svgRef.current?.setPointerCapture?.(e.pointerId); }
      setView(fit({ k: g.start.k, x: g.start.x + dx * unit, y: g.start.y + dy * unit }));
    } else if (g.type === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (!b) return;
      moved.current = true;
      setAnimating(false);
      const k = clamp(g.start.k * (Math.hypot(a.x - b.x, a.y - b.y) / g.dist), MIN, MAX);
      const r = k / g.start.k;
      setView(fit({ k, x: g.center.x - (g.center.x - g.start.x) * r, y: g.center.y - (g.center.y - g.start.y) * r }));
    }
  };

  const end = e => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) { gesture.current = null; setDragging(false); }
    else if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      gesture.current = { type: 'pan', sx: p.x, sy: p.y, start: viewRef.current };
    }
  };

  // กันไม่ให้การลากแผนที่ไปเลือกพื้นที่โดยไม่ตั้งใจ
  const onClickCapture = e => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false; } };

  return {
    svgRef, view, hint, zoomIn: () => zoomAt(1.5), zoomOut: () => zoomAt(1 / 1.5), reset,
    transform: `translate(${view.x} ${view.y}) scale(${view.k})`,
    className: `${animating ? 'is-animating' : ''} ${dragging ? 'is-dragging' : ''} ${view.k > 1 ? 'is-zoomed' : ''}`,
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onPointerLeave: e => { if (e.pointerType === 'mouse') end(e); }, onClickCapture },
    canZoomIn: view.k < MAX, canZoomOut: view.k > MIN,
  };
}
