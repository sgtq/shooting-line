import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { getBasePath } from '../../scripts/vite-base.js'

const configDirectory = new URL('.', import.meta.url)

export default defineConfig({
  base: getBasePath(),
  envDir: fileURLToPath(new URL('../../', configDirectory)),
  plugins: [vue()],
  publicDir: fileURLToPath(new URL('../../public/', configDirectory)),
  build: {
    outDir: fileURLToPath(new URL('../../dist/', configDirectory)),
    emptyOutDir: true,
  },
})
