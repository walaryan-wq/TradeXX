import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Production builds are served from GitHub Pages at /TradeXX/; dev stays at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/TradeXX/' : '/',
  plugins: [react()],
}))
