# @delaneyj/plugin-legacy [![npm](https://img.shields.io/npm/v/@delaneyj/plugin-legacy.svg)](https://npmjs.com/package/@delaneyj/plugin-legacy)

**Note: this plugin requires `grug@^2.0.0-beta.12`**.

grug's default browser support baseline is [Native ESM](https://caniuse.com/es6-module). This plugin provides support for legacy browsers that do not support native ESM.

By default, this plugin will:

- Generate a corresponding legacy chunk for every chunk in the final bundle, transformed with [@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env) and emitted as [SystemJS modules](https://github.com/systemjs/systemjs) (code splitting is still supported!).

- Generate a polyfill chunk including SystemJS runtime, and any necessary polyfills determined by specified browser targets and **actual usage** in the bundle.

- Inject `<script nomodule>` tags into generated HTML to conditionally load the polyfills and legacy bundle only in browsers without native ESM support.

## Usage

```js
// grug.config.js
import legacy from '@delaneyj/plugin-legacy'

export default {
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ]
}
```

## Options

### `targets`

- **Type:** `string | string[] | { [key: string]: string }`
- **Default:** `'defaults'`

  If explicitly set, it's passed on to [`@babel/preset-env`](https://babeljs.io/docs/en/babel-preset-env#targets).

  The query is also [Browserslist compatible](https://github.com/browserslist/browserslist). The default value, `'defaults'`, is what is recommended by Browserslist. See [Browserslist Best Practices](https://github.com/browserslist/browserslist#best-practices) for more details.

### `polyfills`

- **Type:** `boolean | string[]`
- **Default:** `true`

  By default, a polyfills chunk is generated based on the target browser ranges and actual usage in the final bundle (detected via `@babel/preset-env`'s `useBuiltIns: 'usage'`).

  Set to a list of strings to explicitly control which polyfills to include. See [Polyfill Specifiers](#polyfill-specifiers) for details.

  Set to `false` to avoid generating polyfills and handle it yourself (will still generate legacy chunks with syntax transformations).

### `additionalLegacyPolyfills`

- **Type:** `string[]`

  Add custom imports to the legacy polyfills chunk. Since the usage-based polyfill detection only covers ES language features, it may be necessary to manually specify additional DOM API polyfills using this option.

  Note: if additional plyfills are needed for both the modern and legacy chunks, they can simply be imported in the application source code.

### `ignoreBrowserslistConfig`

- **Type:** `boolean`
- **Default:** `false`

  `@babel/preset-env` automatically detects [`browserslist` config sources](https://github.com/browserslist/browserslist#browserslist-):

  - `browserslist` field in `package.json`
  - `.browserslistrc` file in cwd.

  Set to `false` to ignore these sources.

### `modernPolyfills`

- **Type:** `boolean | string[]`
- **Default:** `false`

  Defaults to `false`. Enabling this option will generate a separate polyfills chunk for the modern build (targeting browsers with [native ESM support](https://caniuse.com/es6-module)).

  Set to a list of strings to explicitly control which polyfills to include. See [Polyfill Specifiers](#polyfill-specifiers) for details.

  Note it is **not recommended** to use the `true` value (which uses auto-detection) because `core-js@3` is very aggressive in polyfill inclusions due to all the bleeding edge features it supports. Even when targeting native ESM support, it injects 15kb of polyfills!

  If you don't have hard reliance on bleeding edge runtime features, it is not that hard to avoid having to use polyfills in the modern build altogether. Alternatively, consider using an on-demand service like [Polyfill.io](https://polyfill.io/v3/) to only inject necessary polyfills based on actual browser user-agents (most modern browsers will need nothing!).

### `renderLegacyChunks`

- **Type:** `boolean`
- **Default:** `true`

  Set to `false` to disable legacy chunks. This is only useful if you are using `modernPolyfills`, which essentially allows you to use this plugin for injecting polyfills to the modern build only:

  ```js
  import legacy from '@delaneyj/plugin-legacy'

  export default {
    plugins: [
      legacy({
        modernPolyfills: [
          /* ... */
        ],
        renderLegacyChunks: false
      })
    ]
  }
  ```

## Polyfill Specifiers

Polyfill specifier strings for `polyfills` and `modernPolyfills` can be either of the following:

- Any [`core-js` 3 sub import paths](https://unpkg.com/browse/core-js@3.8.2/) - e.g. `es/map` will import `core-js/es/map`

- Any [individual `core-js` 3 modules](https://unpkg.com/browse/core-js@3.8.2/modules/) - e.g. `es.array.iterator` will import `core-js/modules/es.array.iterator.js`

**Example**

```js
import legacy from '@delaneyj/plugin-legacy'

export default {
  plugins: [
    legacy({
      polyfills: ['es.promise.finally', 'es/map', 'es/set'],
      modernPolyfills: ['es.promise.finally']
    })
  ]
}
```

## Content Security Policy

The legacy plugin requires inline scripts for [Safari 10.1 `nomodule` fix](https://gist.github.com/samthor/64b114e4a4f539915a95b91ffd340acc) and SystemJS initialization. If you have a strict CSP policy requirement, you will need to [add the corresponding hashes to your `script-src` list](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src#unsafe_inline_script):

- `MS6/3FCg4WjP9gwgaBGwLpRCY6fZBgwmhVCdrPrNf3E=`
- `tQjf8gvb2ROOMapIxFvFAYBeUJ0v1HCbOcSmDNXGtDo=`

These values can also be retrived via

```js
const { cspHashes } = require('@delaneyj/plugin-legacy')
```

## References

- [Vue CLI modern mode](https://cli.vuejs.org/guide/browser-compatibility.html#modern-mode)
- [Using Native JavaScript Modules in Production Today](https://philipwalton.com/articles/using-native-javascript-modules-in-production-today/)
- [rollup-native-modules-boilerplate](https://github.com/philipwalton/rollup-native-modules-boilerplate)
