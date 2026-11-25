import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend เดียว (Python / FastAPI, พอร์ต 8000) รับทุก /api: โมเดล + สมาชิก + ชุมชน + แอดมิน
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
});
