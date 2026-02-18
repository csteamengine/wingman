import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react()],

  // Tauri expects a fixed port, fail if port is occupied
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // Exclude Rust build artifacts from HMR
      ignored: ['**/src-tauri/**'],
    },
  },

  // Produce separate source maps for debugging
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // Don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // Keep large dependencies in stable, split vendor chunks.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('/@codemirror/') || id.includes('/codemirror/')) {
            return 'codemirror';
          }

          if (id.includes('/@tauri-apps/')) {
            return 'tauri';
          }

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'react-vendor';
          }

          return 'vendor';
        },
      },
    },
  },

  // Environment variables
  envPrefix: ['VITE_', 'TAURI_ENV_'],

  // Clear screen setting
  clearScreen: false,
});
