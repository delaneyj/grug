// @ts-check
import preactRefresh from '@prefresh/grug'

/**
 * @type { import('grug').UserConfig }
 */
const config = {
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    jsxInject: `import { h, Fragment } from 'preact'`
  },
  plugins: [preactRefresh()]
}

export default config
