const vue = require('@delaneyj/plugin-vue')

/**
 * @type {import('grug').UserConfig}
 */
module.exports = {
  dedupe: ['react'],

  optimizeDeps: {
    include: ['optimize-deps-linked-include'],
    plugins: [vue()]
  },

  build: {
    // to make tests faster
    minify: false
  },

  plugins: [
    vue(),
    // for axios request test
    {
      name: 'mock',
      configureServer({ middlewares }) {
        middlewares.use('/ping', (_, res) => {
          res.statusCode = 200
          res.end('pong')
        })
      }
    }
  ]
}
