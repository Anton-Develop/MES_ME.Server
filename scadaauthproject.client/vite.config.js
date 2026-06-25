import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: true, // or false to disable entirely
    rollupOptions: {
      output: {
        sourcemapIgnoreList: (relativeSourcePath) => relativeSourcePath.includes('node_modules')
      }
    }
  }
})
