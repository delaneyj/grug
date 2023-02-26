import path from 'path'
import { defineConfig } from 'grug'
import vuePlugin from '@delaneyj/plugin-vue'
import { vueI18nPlugin } from './CustomBlockPlugin'

export default defineConfig({
  alias: {
    '/@': __dirname
  },
  plugins: [vuePlugin(), vueI18nPlugin],
  build: {
    // to make tests faster
    minify: false
  }
})
