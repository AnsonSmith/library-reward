import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // The spreadsheet reader uses the browser's DOMParser (research R3), so the
    // test environment must provide one.
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
