import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Frontend test config: jsdom environment for React Testing Library, with a
// global setup file that wires jest-dom matchers and cleanup.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-support/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
