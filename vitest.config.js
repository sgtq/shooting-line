import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    clearMocks: true,
    environment: 'jsdom',
    include: ['apps/**/*.{test,spec}.{js,ts}'],
    restoreMocks: true,
  },
})
