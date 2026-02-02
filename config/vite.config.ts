import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  // Dev server: Rolf opened Docker port range 5000-5100 for this project.
  server: {
    host: '0.0.0.0',
    port: 5050,
    strictPort: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@components': path.resolve(__dirname, '../src/components'),
      '@pages': path.resolve(__dirname, '../src/pages'),
      '@hooks': path.resolve(__dirname, '../src/hooks'),
      '@lib': path.resolve(__dirname, '../src/lib'),
    },
  }
}) 