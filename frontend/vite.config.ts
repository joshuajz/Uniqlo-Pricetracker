import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: process.env.DEV_API_ORIGIN || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
