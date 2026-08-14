import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vitest type augmentation — must be vitest/config to add `test` to defineConfig
/// <reference types="vitest/config" />

// ── Manual chunk map ──────────────────────────────────────────────────
// Separate heavy dependencies into their own cacheable chunks.
// Users only download bpmn/reactflow/export when they reach those pages.
// Repeat visitors get cache hits on vendor chunks that rarely change.
const VENDOR_CHUNKS: Record<string, string[]> = {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-bpmn': ['bpmn-js'],
  'vendor-flow': ['reactflow', 'dagre'],
  'vendor-ai': ['@google/genai'],
  'vendor-export': ['docx', 'exceljs', 'file-saver'],
  'vendor-backend': ['@supabase/supabase-js'],
  'vendor-state': ['zustand', '@tanstack/react-query'],
}

export default defineConfig({
  // Base pública. En GitHub Pages (proyecto) la app vive bajo /<repo>/, así que
  // el workflow de deploy fija VITE_BASE. En local/otros hosts queda en '/'.
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },

  // ── Test configuration ──────────────────────────────────────────────
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/Referencia/**'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**', 'src/lib/schemas/**', 'src/lib/aiSanitizer.ts', 'src/hooks/useAsync.ts'],
      thresholds: { lines: 60, functions: 60 },
    },
  },

  // ── Build optimizations for B2C scalability ─────────────────────────
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 500,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          for (const [chunk, deps] of Object.entries(VENDOR_CHUNKS)) {
            if (deps.some((dep) => id.includes(`node_modules/${dep}/`) || id.includes(`node_modules\\${dep}\\`))) {
              return chunk
            }
          }
        },
      },
    },
  },

  // ── Dev server optimizations ────────────────────────────────────────
  server: {
    warmup: {
      clientFiles: ['./src/App.tsx', './src/pages/Dashboard.tsx'],
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'lucide-react',
    ],
  },
})
