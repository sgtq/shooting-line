import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    clearMocks: true,
    coverage: {
      exclude: ['**/*.test.js', '**/test-utils/**', 'tests/**'],
      include: ['apps/*/src/**', 'packages/*/src/**'],
      provider: 'v8',
      reporter: ['text-summary', 'html'],
    },
    environment: 'jsdom',
    globals: true,
    include: [
      'apps/**/*.{test,spec}.{js,ts}',
      'packages/**/*.{test,spec}.{js,ts}',
      'scripts/**/*.{test,spec}.{js,ts}',
      'supabase/functions/**/*.{test,spec}.{js,ts}',
      'test-utils/**/*.{test,spec}.{js,ts}',
    ],
    restoreMocks: true,
    setupFiles: ['./test-utils/vitest.setup.js'],
  },
})
