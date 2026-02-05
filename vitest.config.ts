import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/__tests__/**/*.ts', 'mobile/__tests__/**/*.ts'],
    threads: false,
  },
});
