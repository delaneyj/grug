const reactRefresh = require('@delaneyj/plugin-react-refresh')

/**
 * @type {import('grug').UserConfig}
 */
module.exports = {
  plugins: [reactRefresh()],
  build: {
    // to make tests faster
    minify: false
  },
  esbuild: {
    jsxInject: `import React from 'react'`
  }
}
