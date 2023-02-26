# JavaScript API

grug's JavaScript APIs are fully typed, and it's recommended to use TypeScript or enable JS type checking in VSCode to leverage the intellisense and validation.

## `createServer`

**Type Signature**

```ts
async function createServer(inlineConfig?: InlineConfig): Promise<grugDevServer>
```

**Example Usage**

```js
const { createServer } = require('grug')

;(async () => {
  const server = await createServer({
    // any valid user config options, plus `mode` and `configFile`
    configFile: false,
    root: __dirname,
    server: {
      port: 1337
    }
  })
  await server.listen()
})()
```

### Using the grug Server as a Middleware

grug can be used as a middleware in an existing raw Node.js http server or frameworks that are comaptible with the `(req, res, next) => {}` style middlewares. For example with `express`:

```js
const grug = require('grug')
const express = require('express')

;(async () => {
  const app = express()

  // create grug dev server in middleware mode
  // so grug creates the hmr websocket server on its own.
  // the ws server will be listening at port 24678 by default, and can be
  // configured via server.hmr.port
  const grugServer = await grug.createServer({
    server: {
      middlewareMode: true
    }
  })

  // use grug's connect instance as middleware
  app.use(grugServer.app)

  app.use('*', (req, res) => {
    // serve custom index.html
  })

  app.listen(3000)
})()
```

Note that in middleware mode, grug will not be serving `index.html` - that is now the responsibility of the parent server. When serving the HTML, make sure to include a link to grug's dev client:

```html
<script type="module" src="/@grug/client"></script>
```

## `InlineConfig`

The `InlineConfig` interface extends `UserConfig` with additional properties:

- `mode`: override default mode (`'development'` for server)
- `configFile`: specify config file to use. If not set, grug will try to automatically resolve one from project root. Set to `false` to disable auto resolving.

## `grugDevServer`

```ts
interface grugDevServer {
  /**
   * The resolved grug config object
   */
  config: ResolvedConfig
  /**
   * connect app instance
   * This can also be used as the handler function of a custom http server
   * https://github.com/senchalabs/connect#use-middleware
   */
  app: Connect.Server
  /**
   * native Node http server instance
   */
  httpServer: http.Server
  /**
   * chokidar watcher instance
   * https://github.com/paulmillr/chokidar#api
   */
  watcher: FSWatcher
  /**
   * web socket server with `send(payload)` method
   */
  ws: WebSocketServer
  /**
   * Rollup plugin container that can run plugin hooks on a given file
   */
  pluginContainer: PluginContainer
  /**
   * Module graph that tracks the import relationships, url to file mapping
   * and hmr state.
   */
  moduleGraph: ModuleGraph
  /**
   * Programmatically resolve, load and transform a URL and get the result
   * without going through the http request pipeline.
   */
  transformRequest(url: string): Promise<TransformResult | null>
  /**
   * Util for transforming a file with esbuild.
   * Can be useful for certain plugins.
   */
  transformWithEsbuild(
    code: string,
    filename: string,
    options?: EsbuildTransformOptions,
    inMap?: object
  ): Promise<EsbuildTransformResult>
  /**
   * Start the server.
   */
  listen(port?: number): Promise<grugDevServer>
  /**
   * Stop the server.
   */
  close(): Promise<void>
}
```

## `build`

**Type Signature**

```ts
async function build(
  inlineConfig?: InlineConfig
): Promise<RollupOutput | RollupOutput[]>
```

**Example Usage**

```js
const path = require('path')
const { build } = require('grug')

;(async () => {
  await build({
    root: path.resolve(__dirname, './project'),
    build: {
      base: '/foo/',
      rollupOptions: {
        // ...
      }
    }
  })
})()
```

## `resolveConfig`

**Type Signature**

```ts
async function resolveConfig(
  inlineConfig: InlineConfig,
  command: 'build' | 'serve'
): Promise<ResolvedConfig>
```
