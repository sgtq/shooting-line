/** @type {import('tailwindcss').Config} */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDirectory = fileURLToPath(new URL('.', import.meta.url))

export default {
  content: [resolve(rootDirectory, 'apps/**/*.{vue,js,html}')],
  theme: {
    extend: {},
  },
  plugins: [],
}
