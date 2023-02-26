const vueJsxPlugin = require('@delaneyj/plugin-vue-jsx')

/**
 * @type {import('grug').UserConfig}
 */
module.exports = {
  plugins: [vueJsxPlugin()],
  build: {
    // to make tests faster
    minify: false
  }
}
