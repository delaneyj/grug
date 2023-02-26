// @ts-check
import vuePlugin from '@delaneyj/plugin-vue'
import reactRefresh from '@delaneyj/plugin-react-refresh'

/**
 * @type {import('grug').UserConfig}
 */
export default {
  plugins: [vuePlugin(), reactRefresh()],
  build: {
    minify: false
  }
}
