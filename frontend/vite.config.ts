import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // '/app/' é o path usado no deploy self-hosted (Docker/nginx).
  // O workflow do GitHub Pages sobrescreve via VITE_BASE_PATH=/SLA-monitoring-dashboard/.
  base: process.env.VITE_BASE_PATH ?? '/app/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
