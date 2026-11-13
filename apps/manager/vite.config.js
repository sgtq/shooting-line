import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { getBasePath } from '../../scripts/vite-base.js'

const configDirectory = new URL('.', import.meta.url)

export default defineConfig({
  base: getBasePath('manager'),
  envDir: fileURLToPath(new URL('../../', configDirectory)),
  plugins: [vue()],
  publicDir: fileURLToPath(new URL('../../public/', configDirectory)),
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: fileURLToPath(new URL('../../dist/manager/', configDirectory)),
    emptyOutDir: false,
  },
})
