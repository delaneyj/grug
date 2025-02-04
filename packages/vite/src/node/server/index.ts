import os from 'os'
import fs from 'fs'
import path from 'path'
import * as net from 'net'
import * as http from 'http'
import * as https from 'https'
import connect from 'connect'
import corsMiddleware from 'cors'
import chalk from 'chalk'
import { AddressInfo } from 'net'
import chokidar from 'chokidar'
import { resolveConfig, InlineConfig, ResolvedConfig } from '../config'
import {
  createPluginContainer,
  PluginContainer
} from '../server/pluginContainer'
import { FSWatcher, WatchOptions } from 'types/chokidar'
import { resolveHttpsConfig } from '../server/https'
import { createWebSocketServer, WebSocketServer } from '../server/ws'
import { proxyMiddleware, ProxyOptions } from './middlewares/proxy'
import { transformMiddleware } from './middlewares/transform'
import { indexHtmlMiddleware } from './middlewares/indexHtml'
import history from 'connect-history-api-fallback'
import {
  serveRawFsMiddleware,
  servePublicMiddleware,
  serveStaticMiddleware
} from './middlewares/static'
import { timeMiddleware } from './middlewares/time'
import { ModuleGraph } from './moduleGraph'
import { Connect } from 'types/connect'
import { createDebugger, normalizePath } from '../utils'
import { errorMiddleware, prepareError } from './middlewares/error'
import { handleHMRUpdate, HmrOptions } from './hmr'
import { openBrowser } from './openBrowser'
import launchEditorMiddleware from 'launch-editor-middleware'
import { TransformResult } from 'rollup'
import { TransformOptions, transformRequest } from './transformRequest'
import {
  transformWithEsbuild,
  EsbuildTransformResult
} from '../plugins/esbuild'
import { TransformOptions as EsbuildTransformOptions } from 'esbuild'
import { DepOptimizationMetadata, optimizeDeps } from '../optimizer'
import { ssrLoadModule } from '../ssr/ssrModuleLoader'
import { resolveSSRExternal } from '../ssr/ssrExternal'
import { ssrRewriteStacktrace } from '../ssr/ssrStacktrace'

export interface ServerOptions {
  host?: string
  port?: number
  /**
   * Enable TLS + HTTP/2.
   * Note: this downgrades to TLS only when the proxy option is also used.
   */
  https?: boolean | https.ServerOptions
  /**
   * Open browser window on startup
   */
  open?: boolean | string
  /**
   * Force dep pre-optimization regardless of whether deps have changed.
   */
  force?: boolean
  /**
   * Configure HMR-specific options (port, host, path & protocol)
   */
  hmr?: HmrOptions | boolean
  /**
   * chokidar watch options
   * https://github.com/paulmillr/chokidar#api
   */
  watch?: WatchOptions
  /**
   * Configure custom proxy rules for the dev server. Expects an object
   * of `{ key: options }` pairs.
   * Uses [`http-proxy`](https://github.com/http-party/node-http-proxy).
   * Full options [here](https://github.com/http-party/node-http-proxy#options).
   *
   * Example `grug.config.js`:
   * ``` js
   * module.exports = {
   *   proxy: {
   *     // string shorthand
   *     '/foo': 'http://localhost:4567/foo',
   *     // with options
   *     '/api': {
   *       target: 'http://jsonplaceholder.typicode.com',
   *       changeOrigin: true,
   *       rewrite: path => path.replace(/^\/api/, '')
   *     }
   *   }
   * }
   * ```
   */
  proxy?: Record<string, string | ProxyOptions>
  /**
   * Configure CORS for the dev server.
   * Uses https://github.com/expressjs/cors.
   * Set to `true` to allow all methods from any origin, or configure separately
   * using an object.
   */
  cors?: CorsOptions | boolean
  /**
   * If enabled, grug will exit if specified port is already in use
   */
  strictPort?: boolean
  /**
   * Create grug dev server to be used as a middleware in an existing server
   */
  middlewareMode?: boolean
}

/**
 * https://github.com/expressjs/cors#configuration-options
 */
export interface CorsOptions {
  origin?:
    | CorsOrigin
    | ((origin: string, cb: (err: Error, origins: CorsOrigin) => void) => void)
  methods?: string | string[]
  allowedHeaders?: string | string[]
  exposedHeaders?: string | string[]
  credentials?: boolean
  maxAge?: number
  preflightContinue?: boolean
  optionsSuccessStatus?: number
}

export type CorsOrigin = boolean | string | RegExp | (string | RegExp)[]

export type ServerHook = (
  server: grugDevServer
) => (() => void) | void | Promise<(() => void) | void>

export interface grugDevServer {
  /**
   * The resolved grug config object
   */
  config: ResolvedConfig
  /**
   * A connect app instance.
   * - Can be used to attach custom middlewares to the dev server.
   * - Can also be used as the handler function of a custom http server
   *   or as a middleware in any connect-style Node.js frameworks
   *
   * https://github.com/senchalabs/connect#use-middleware
   */
  middlewares: Connect.Server
  /**
   * @deprecated use `server.middlewares` instead
   */
  app: Connect.Server
  /**
   * native Node http server instance
   * will be null in middleware mode
   */
  httpServer: http.Server | null
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
  transformRequest(
    url: string,
    options?: TransformOptions
  ): Promise<TransformResult | null>
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
   * Load a given URL as an instantiated module for SSR.
   * @alpha
   */
  ssrLoadModule(
    url: string,
    options?: { isolated?: boolean }
  ): Promise<Record<string, any>>
  /**
   * Fix ssr error stacktrace
   * @alpha
   */
  ssrFixStacktrace(e: Error): void
  /**
   * Start the server.
   */
  listen(port?: number): Promise<grugDevServer>
  /**
   * Stop the server.
   */
  close(): Promise<void>
  /**
   * @internal
   */
  _optimizeDepsMetadata: DepOptimizationMetadata | null
  /**
   * Deps that are extenralized
   * @internal
   */
  _ssrExternals: string[] | null
}

export async function createServer(
  inlineConfig: InlineConfig = {}
): Promise<grugDevServer> {
  const config = await resolveConfig(inlineConfig, 'serve', 'development')
  const root = config.root
  const serverConfig = config.server || {}
  const middlewareMode = !!serverConfig.middlewareMode

  const middlewares = connect() as Connect.Server
  const httpServer = middlewareMode
    ? null
    : await resolveHttpServer(serverConfig, middlewares)
  const ws = createWebSocketServer(httpServer, config)

  const watchOptions = serverConfig.watch || {}
  const watcher = chokidar.watch(root, {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      ...(watchOptions.ignored || [])
    ],
    ignoreInitial: true,
    ignorePermissionErrors: true,
    ...watchOptions
  }) as FSWatcher

  const plugins = config.plugins
  const container = await createPluginContainer(config, watcher)
  const moduleGraph = new ModuleGraph(container)
  const closeHttpServer = createSeverCloseFn(httpServer)

  const server: grugDevServer = {
    config: config,
    middlewares,
    get app() {
      config.logger.warn(
        `grugDevServer.app is deprecated. Use grugDevServer.middlewares instead.`
      )
      return middlewares
    },
    httpServer,
    watcher,
    pluginContainer: container,
    ws,
    moduleGraph,
    transformWithEsbuild,
    transformRequest(url, options) {
      return transformRequest(url, server, options)
    },
    ssrLoadModule(url, options) {
      if (!server._ssrExternals) {
        server._ssrExternals = resolveSSRExternal(config)
      }
      return ssrLoadModule(url, server, !!options?.isolated)
    },
    ssrFixStacktrace(e) {
      if (e.stack) {
        e.stack = ssrRewriteStacktrace(e.stack, moduleGraph)
      }
    },
    listen(port?: number) {
      return startServer(server, port)
    },
    async close() {
      await Promise.all([
        watcher.close(),
        ws.close(),
        container.close(),
        closeHttpServer()
      ])
    },
    _optimizeDepsMetadata: null,
    _ssrExternals: null
  }

  process.once('SIGTERM', async () => {
    try {
      await server.close()
    } finally {
      process.exit(0)
    }
  })

  watcher.on('change', async (file) => {
    file = normalizePath(file)
    // invalidate module graph cache on file change
    moduleGraph.onFileChange(file)
    if (serverConfig.hmr !== false) {
      try {
        await handleHMRUpdate(file, server)
      } catch (err) {
        ws.send({
          type: 'error',
          err: prepareError(err)
        })
      }
    }
  })

  // apply server configuration hooks from plugins
  const postHooks: ((() => void) | void)[] = []
  for (const plugin of plugins) {
    if (plugin.configureServer) {
      postHooks.push(await plugin.configureServer(server))
    }
  }

  // Internal middlewares ------------------------------------------------------

  // request timer
  if (process.env.DEBUG) {
    middlewares.use(timeMiddleware(root))
  }

  // cors (enabled by default)
  const { cors } = serverConfig
  if (cors !== false) {
    middlewares.use(corsMiddleware(typeof cors === 'boolean' ? {} : cors))
  }

  // proxy
  const { proxy } = serverConfig
  if (proxy) {
    middlewares.use(proxyMiddleware(server))
  }

  // open in editor support
  middlewares.use('/__open-in-editor', launchEditorMiddleware())

  // serve static files under /public
  // this applies before the transform middleware so that these files are served
  // as-is without transforms.
  middlewares.use(servePublicMiddleware(path.join(root, 'public')))

  // main transform middleware
  middlewares.use(transformMiddleware(server))

  // serve static files
  middlewares.use(serveRawFsMiddleware())
  middlewares.use(serveStaticMiddleware(root, config))

  // spa fallback
  middlewares.use(
    history({
      logger: createDebugger('grug:spa-fallback'),
      // support /dir/ without explicit index.html
      rewrites: [
        {
          from: /\/$/,
          to({ parsedUrl }: any) {
            const rewritten = parsedUrl.pathname + 'index.html'
            if (fs.existsSync(path.join(root, rewritten))) {
              return rewritten
            } else {
              return `/index.html`
            }
          }
        }
      ]
    })
  )

  // run post config hooks
  // This is applied before the html middleware so that user middleware can
  // serve custom content instead of index.html.
  postHooks.forEach((fn) => fn && fn())

  if (!middlewareMode) {
    // transform index.html
    middlewares.use(indexHtmlMiddleware(server, plugins))
    // handle 404s
    middlewares.use((_, res) => {
      res.statusCode = 404
      res.end()
    })
  }

  // error handler
  middlewares.use(errorMiddleware(server, middlewareMode))

  const runOptimize = async () => {
    if (config.optimizeCacheDir) {
      // run optimizer
      await optimizeDeps(config)
      // after optimization, read updated optimization metadata
      const dataPath = path.resolve(config.optimizeCacheDir, 'metadata.json')
      if (fs.existsSync(dataPath)) {
        server._optimizeDepsMetadata = JSON.parse(
          fs.readFileSync(dataPath, 'utf-8')
        )
      }
    }
  }

  if (!middlewareMode && httpServer) {
    // overwrite listen to run optimizer before server start
    const listen = httpServer.listen.bind(httpServer)
    httpServer.listen = (async (port: number, ...args: any[]) => {
      await container.buildStart({})
      await runOptimize()
      return listen(port, ...args)
    }) as any

    httpServer.once('listening', () => {
      // update actual port since this may be different from initial value
      serverConfig.port = (httpServer.address() as AddressInfo).port
    })
  } else {
    await runOptimize()
  }

  return server
}

async function resolveHttpServer(
  { https = false, proxy }: ServerOptions,
  app: Connect.Server
): Promise<http.Server> {
  if (!https) {
    return require('http').createServer(app)
  }

  const httpsOptions = await resolveHttpsConfig(
    typeof https === 'boolean' ? {} : https
  )
  if (proxy) {
    // #484 fallback to http1 when proxy is needed.
    return require('https').createServer(httpsOptions, app)
  } else {
    return require('http2').createSecureServer(
      {
        ...httpsOptions,
        allowHTTP1: true
      },
      app
    )
  }
}

async function startServer(
  server: grugDevServer,
  inlinePort?: number
): Promise<grugDevServer> {
  const httpServer = server.httpServer
  if (!httpServer) {
    throw new Error('Cannot call server.listen in middleware mode.')
  }

  const options = server.config.server || {}
  let port = inlinePort || options.port || 3000
  let hostname = options.host || 'localhost'
  const protocol = options.https ? 'https' : 'http'
  const info = server.config.logger.info

  return new Promise((resolve, reject) => {
    const onError = (e: Error & { code?: string }) => {
      if (e.code === 'EADDRINUSE') {
        if (options.strictPort) {
          httpServer.removeListener('error', onError)
          reject(new Error(`Port ${port} is already in use`))
        } else {
          info(`Port ${port} is in use, trying another one...`)
          httpServer.listen(++port)
        }
      } else {
        httpServer.removeListener('error', onError)
        reject(e)
      }
    }

    httpServer.on('error', onError)

    httpServer.listen(port, () => {
      httpServer.removeListener('error', onError)

      info(`\n  grug dev server running at:\n`, { clear: true })
      const interfaces = os.networkInterfaces()
      Object.keys(interfaces).forEach((key) =>
        (interfaces[key] || [])
          .filter((details) => details.family === 'IPv4')
          .map((detail) => {
            return {
              type: detail.address.includes('127.0.0.1')
                ? 'Local:   '
                : 'Network: ',
              host: detail.address.replace('127.0.0.1', hostname)
            }
          })
          .forEach(({ type, host }) => {
            const url = `${protocol}://${host}:${chalk.bold(port)}/`
            info(`  > ${type} ${chalk.cyan(url)}`)
          })
      )

      // @ts-ignore
      if (global.__grug_start_time) {
        info(
          chalk.cyan(
            // @ts-ignore
            `\n  ready in ${Date.now() - global.__grug_start_time}ms.\n`
          )
        )
      }

      // @ts-ignore
      const profileSession = global.__grug_profile_session
      if (profileSession) {
        profileSession.post('Profiler.stop', (err: any, { profile }: any) => {
          // Write profile to disk, upload, etc.
          if (!err) {
            const outPath = path.resolve('./grug-profile.cpuprofile')
            fs.writeFileSync(outPath, JSON.stringify(profile))
            info(
              chalk.yellow(
                `  CPU profile written to ${chalk.white.dim(outPath)}\n`
              )
            )
          } else {
            throw err
          }
        })
      }

      if (options.open) {
        const path = typeof options.open === 'string' ? options.open : ''
        openBrowser(
          `${protocol}://${hostname}:${port}${path}`,
          true,
          server.config.logger
        )
      }

      resolve(server)
    })
  })
}

function createSeverCloseFn(server: http.Server | null) {
  if (!server) {
    return () => {}
  }

  const openSockets = new Set<net.Socket>()

  server.on('connection', (socket) => {
    openSockets.add(socket)
    socket.on('close', () => {
      openSockets.delete(socket)
    })
  })

  return () =>
    new Promise<void>((resolve, reject) => {
      openSockets.forEach((s) => s.destroy())
      server.close((err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
}
