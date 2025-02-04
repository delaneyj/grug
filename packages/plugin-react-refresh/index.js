// @ts-check
const fs = require('fs')
const { transformSync } = require('@babel/core')

const runtimePublicPath = '/@react-refresh'
const runtimeFilePath = require.resolve(
  'react-refresh/cjs/react-refresh-runtime.development.js'
)

const runtimeCode = `
const exports = {}
${fs.readFileSync(runtimeFilePath, 'utf-8')}
function debounce(fn, delay) {
  let handle
  return () => {
    clearTimeout(handle)
    handle = setTimeout(fn, delay)
  }
}
exports.performReactRefresh = debounce(exports.performReactRefresh, 16)
export default exports
`

const preambleCode = `
import RefreshRuntime from "${runtimePublicPath}"
RefreshRuntime.injectIntoGlobalHook(window)
window.$RefreshReg$ = () => {}
window.$RefreshSig$ = () => (type) => type
window.__grug_plugin_react_preamble_installed__ = true
`

/**
 * Transform plugin for transforming and injecting per-file refresh code.
 *
 * @returns {import('grug').Plugin}
 */
module.exports = function reactRefreshPlugin() {
  let shouldSkip = false

  return {
    name: 'react-refresh',

    configResolved(config) {
      shouldSkip = config.command === 'build' || config.isProduction
    },

    resolveId(id) {
      if (id === runtimePublicPath) {
        return id
      }
    },

    load(id) {
      if (id === runtimePublicPath) {
        return runtimeCode
      }
    },

    transform(code, id, ssr) {
      if (shouldSkip || ssr) {
        return
      }

      if (!/\.(t|j)sx?$/.test(id) || id.includes('node_modules')) {
        return
      }

      // plain js/ts files can't use React without importing it, so skip
      // them whenever possible
      if (!id.endsWith('x') && !code.includes('react')) {
        return
      }

      const isReasonReact = id.endsWith('.bs.js')
      const result = transformSync(code, {
        plugins: [
          require('@babel/plugin-syntax-import-meta'),
          [require('react-refresh/babel'), { skipEnvCheck: true }]
        ],
        ast: !isReasonReact,
        sourceMaps: true,
        sourceFileName: id
      })

      if (!/\$RefreshReg\$\(/.test(result.code)) {
        // no component detected in the file
        return code
      }

      const header = `
  import RefreshRuntime from "${runtimePublicPath}";

  let prevRefreshReg;
  let prevRefreshSig;

  if (!window.__grug_plugin_react_preamble_installed__) {
    throw new Error(
      "grug-plugin-react can't detect preamble. Something is wrong" +
      "See https://github.com/delaneyj/grug-plugin-react/pull/11#discussion_r430879201"
    );
  }

  if (import.meta.hot) {
    prevRefreshReg = window.$RefreshReg$;
    prevRefreshSig = window.$RefreshSig$;
    window.$RefreshReg$ = (type, id) => {
      RefreshRuntime.register(type, ${JSON.stringify(id)} + " " + id)
    };
    window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
  }`.replace(/[\n]+/gm, '')

      const footer = `
  if (import.meta.hot) {
    window.$RefreshReg$ = prevRefreshReg;
    window.$RefreshSig$ = prevRefreshSig;

    ${
      isReasonReact || isRefreshBoundary(result.ast)
        ? `import.meta.hot.accept();`
        : ``
    }
    if (!window.__grug_plugin_react_timeout) {
      window.__grug_plugin_react_timeout = setTimeout(() => {
        window.__grug_plugin_react_timeout = 0;
        RefreshRuntime.performReactRefresh();
      }, 30);
    }
  }`

      return {
        code: `${header}${result.code}${footer}`,
        map: result.map
      }
    },

    transformIndexHtml() {
      if (shouldSkip) {
        return
      }

      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: preambleCode
        }
      ]
    }
  }
}

module.exports.preambleCode = preambleCode

/**
 * @param {import('@babel/core').BabelFileResult['ast']} ast
 */
function isRefreshBoundary(ast) {
  // Every export must be a React component.
  return ast.program.body.every((node) => {
    if (node.type !== 'ExportNamedDeclaration') {
      return true
    }
    const { declaration, specifiers } = node
    if (declaration && declaration.type === 'VariableDeclaration') {
      return declaration.declarations.every(
        ({ id }) => id.type === 'Identifier' && isComponentishName(id.name)
      )
    }
    return specifiers.every(
      ({ exported }) =>
        exported.type === 'Identifier' && isComponentishName(exported.name)
    )
  })
}

/**
 * @param {string} name
 */
function isComponentishName(name) {
  return typeof name === 'string' && name[0] >= 'A' && name[0] <= 'Z'
}
