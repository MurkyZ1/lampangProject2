import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ToastProvider } from './components/ui/Toast';
import './styles.css';
import './pages.css';

// Ripple effect ของปุ่ม (ทำงานแบบ delegation จุดเดียว ไม่ทำให้ component re-render)
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
document.addEventListener('pointerdown', (e) => {
  if (reduceMotion?.matches) return;
  const el = e.target.closest?.('.btn, .ripple');
  if (!el || el.disabled) return;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.6;
  const dot = document.createElement('span');
  dot.className = 'ripple-dot';
  dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
  el.appendChild(dot);
  dot.addEventListener('animationend', () => dot.remove(), { once: true });
}, { passive: true });

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
);
