import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': { target: 'http://127.0.0.1:3000', ws: true },
      '/health': 'http://127.0.0.1:3000',
    },
    watch: process.env.VITE_DISABLE_WATCH === '1' ? null : undefined,
  },
  resolve: { preserveSymlinks: true },
  optimizeDeps: { esbuildOptions: { preserveSymlinks: true, tsconfigRaw: {} } },
});
