import { useEffect } from 'react';

/**
 * Scroll reveal ทั้งเว็บ: ทุก element ที่มี [data-reveal] จะได้คลาส is-in เมื่อเลื่อนมาเห็น
 * ใช้ MutationObserver จับ element ที่ถูกเพิ่มภายหลัง (เช่น หน้าที่ lazy-load)
 * CSS ปิด animation ให้อัตโนมัติเมื่อผู้ใช้ตั้ง prefers-reduced-motion
 */
export default function useReveal() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      document.documentElement.classList.add('no-reveal');
      return undefined;
    }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    const scan = root => {
      if (!(root instanceof Element)) return;
      if (root.matches('[data-reveal]:not(.is-in)')) io.observe(root);
      root.querySelectorAll('[data-reveal]:not(.is-in)').forEach(n => io.observe(n));
    };
    scan(document.body);
    const mo = new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(scan)));
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
}
