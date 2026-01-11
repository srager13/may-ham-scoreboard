import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../static',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0', // Listen on all interfaces for nginx proxy
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'mayhamscoreboard.com',
      'dev.mayhamscoreboard.com'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
})