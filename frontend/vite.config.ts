import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      '@hardware': fileURLToPath(new URL('../hardware', import.meta.url)),
    },
  },
  server: {
    host: true, port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/api':  { target: 'http://localhost:8000', changeOrigin: true },
      '/live': { target: 'ws://localhost:8000', ws: true, changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/') || id.includes('node_modules/@react-three/')) return 'three'
          return undefined
        },
      },
    },
  },
})
