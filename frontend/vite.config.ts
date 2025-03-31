import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    hmr: true,
    // Allow all hosts since we're in a Replit environment
    allowedHosts: [
      '.replit.dev',
      '.repl.co',
      'localhost',
      '0.0.0.0',
      '*.spock.replit.dev'
    ]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
      "@schema": path.resolve(__dirname, "../shared/schema")
    }
  },
  base: './',
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
})
