# @delaneyj/plugin-vue-jsx [![npm](https://img.shields.io/npm/v/@delaneyj/plugin-vue-jsx.svg)](https://npmjs.com/package/@delaneyj/plugin-vue-jsx)

Provides Vue 3 JSX & TSX support with HMR.

```js
// grug.config.js
import vueJsx from '@delaneyj/plugin-vue-jsx'

export default {
  plugins: [
    vueJsx({
      // options are passed on to @vue/babel-plugin-jsx
    })
  ]
}
```

## Options

See [@vue/babel-plugin-jsx](https://github.com/vuejs/jsx-next).
## HMR Detection

This plugin supports HMR of Vue JSX components. The detection requirements are:

- The component must be exported.
- The component must be declared by calling `defineComponent` via a root-level statement, either variable declaration or export declaration.

### Supported patterns

```jsx
import { defineComponent } from 'vue'

// named exports w/ variable declaration: ok
export const Foo = defineComponent(...)

// named exports referencing variable declaration: ok
const Bar = defineComponent(...)
export { Bar }

// default export call: ok
export default defineComponent(...)

// default export referencing variable declaration: ok
const Baz = defineComponent(...)
export default Baz
```

### Non-supported patterns

```jsx
// not using `defineComponent` call
export const Bar = { ... }

// not exported
const Foo = defineComponent(...)
```