import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** Renderer-only server for browser visual QA; Electron keeps its own config. */
export default defineConfig({
  root: resolve('src/renderer'),
  envDir: resolve('.'),
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared'),
    },
  },
  plugins: [react()],
})
