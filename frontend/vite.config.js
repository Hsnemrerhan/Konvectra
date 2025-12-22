import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [react(), nodePolyfills()],
  define: {
    // Simple-peer için gerekli global tanımı
    global: 'window',
    'process.env': {}
  },
  resolve: {
    alias: {
      process: "process/browser",
      stream: "stream-browserify",
      zlib: "browserify-zlib",
      util: "util"
    }
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true
    }
  }
})