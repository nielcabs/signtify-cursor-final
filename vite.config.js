import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', // Listen on IPv4 localhost
    port: 5173,
    strictPort: false, // Allow fallback to next available port if 5173 is taken
  },
})
