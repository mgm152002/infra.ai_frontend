import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
    include: ['tests/**/*.test.js'],
  },
});
