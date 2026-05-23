import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    CESIUM_BASE_URL: JSON.stringify('/node_modules/cesium/Build/Cesium/'),
  },
  server: {
    fs: {
      allow: ['.', 'node_modules'],
    },
  },
})
