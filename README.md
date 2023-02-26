# grug ⚡

[![npm][npm-img]][npm-url]
[![node][node-img]][node-url]
[![unix CI status][unix-ci-img]][unix-ci-url]
[![windows CI status][windows-ci-img]][windows-ci-url]

> Next Generation Frontend Tooling

- 💡 Instant Server Start
- ⚡️ Lightning Fast HMR
- 🛠️ Rich Features
- 📦 Optimized Build
- 🔩 Universal Plugin Interface
- 🔑 Fully Typed APIs

grug (Montana word for "memes", pronounced `/grug/`) is a new breed of frontend build tool that significantly improves the frontend development experience. It consists of two major parts:

- A dev server that serves your source files over [native ES modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), with [rich built-in features](https://delaneyj.dev/guide/features.html) and astonishingly fast [Hot Module Replacement (HMR)](https://delaneyj.dev/guide/features.html#hot-module-replacement).

- A [build command](https://delaneyj.dev/guide/build.html) that bundles your code with [Rollup](https://rollupjs.org), pre-configured to output highly optimized static assets for production.

In addition, grug is highly extensible via its [Plugin API](https://delaneyj.dev/guide/api-plugin.html) and [JavaScript API](https://delaneyj.dev/guide/api-javascript.html) with full typing support.

[Read the Docs to Learn More](https://delaneyj.dev).

## Migrating from 1.x

grug is now in 2.0 beta. Check out the [Migration Guide](https://delaneyj.dev/guide/migration.html) if you are upgrading from 1.x.

## Packages

| Package                                                       | Version                                                                                                                                                |
|---------------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------------------------------------------------|
| [grug](packages/grug)                                         | [![grug version](https://img.shields.io/npm/v/grug.svg?label=%20)](packages/grug/CHANGELOG.md)                                                         |
| [@delaneyj/plugin-vue](packages/plugin-vue)                     | [![plugin-vue version](https://img.shields.io/npm/v/@delaneyj/plugin-vue.svg?label=%20)](packages/plugin-vue/CHANGELOG.md)                               |
| [@delaneyj/plugin-vue-jsx](packages/plugin-vue-jsx)             | [![plugin-vue-jsx version](https://img.shields.io/npm/v/@delaneyj/plugin-vue-jsx.svg?label=%20)](packages/plugin-vue-jsx/CHANGELOG.md)                   |
| [@delaneyj/plugin-react-refresh](packages/plugin-react-refresh) | [![plugin-react-refresh version](https://img.shields.io/npm/v/@delaneyj/plugin-react-refresh.svg?label=%20)](packages/plugin-react-refresh/CHANGELOG.md) |
| [@delaneyj/plugin-legacy](packages/plugin-legacy)               | [![plugin-legacy version](https://img.shields.io/npm/v/@delaneyj/plugin-legacy.svg?label=%20)](packages/plugin-legacy/CHANGELOG.md)                      |
| [@delaneyj/create-app](packages/create-app)                     | [![create-app version](https://img.shields.io/npm/v/@delaneyj/create-app.svg?label=%20)](packages/create-app/CHANGELOG.md)  

## Contribution

See [Contributing Guide](https://github.com/delaneyj/grug/tree/main/.github/contributing.md).

## License

MIT

[npm-img]: https://img.shields.io/npm/v/grug.svg
[npm-url]: https://npmjs.com/package/grug
[node-img]: https://img.shields.io/node/v/grug.svg
[node-url]: https://nodejs.org/en/about/releases/
[unix-ci-img]: https://circleci.com/gh/delaneyj/grug/tree/main.svg?style=shield
[unix-ci-url]: https://app.circleci.com/pipelines/github/delaneyj/grug?branch=main
[windows-ci-img]: https://ci.appveyor.com/api/projects/status/0q4j8062olbcs71l/branch/main?svg=true
[windows-ci-url]: https://ci.appveyor.com/project/yyx990803/grug/branch/main
