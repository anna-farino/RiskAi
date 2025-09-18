import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { copyFileSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-staticwebapp-config',
      writeBundle() {
        copyFileSync(
          path.resolve(__dirname, 'staticwebapp.config.json'),
          path.resolve(__dirname, 'build/staticwebapp.config.json')
        )
      }
    }
  ],
  server: {
    port: 5174,
    host: true,
    hmr: { overlay: false },
    watch: {
      ignored: ['**/.DS_Store']
    },
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
  build: {
    outDir: 'build',
    sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
    minify: 'esbuild',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
})
