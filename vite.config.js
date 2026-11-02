import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development, /api is proxied to the Flask server (python -m backend.app).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:5000' },
  },
  build: { chunkSizeWarningLimit: 1500 },
});
