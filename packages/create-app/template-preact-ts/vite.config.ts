import preactRefresh from '@prefresh/grug'
import { defineConfig } from 'grug'

export default defineConfig({
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment'
  },
  plugins: [preactRefresh()]
})
