import { defineConfig } from 'vitest/config';

// `base` is set by the Pages workflow (repo subpath); local dev uses '/'.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  build: { target: 'es2022', chunkSizeWarningLimit: 6000 },
  // The win-probability worker (src/ui/montecarlo.worker.ts) is an ES module worker.
  worker: { format: 'es' },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
