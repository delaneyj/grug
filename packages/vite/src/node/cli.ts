import { cac } from 'cac'
import chalk from 'chalk'
import { BuildOptions } from './build'
import { ServerOptions } from './server'
import { createLogger, LogLevel } from './logger'
import { resolveConfig } from '.'

const cli = cac('grug')

// global options
interface GlobalCLIOptions {
  '--'?: string[]
  debug?: boolean | string
  d?: boolean | string
  filter?: string
  f?: string
  config?: string
  c?: boolean | string
  root?: string
  r?: string
  mode?: string
  m?: string
  logLevel?: LogLevel
  l?: LogLevel
  clearScreen?: boolean
}

/**
 * removing global flags before passing as command specific sub-configs
 */
function cleanOptions(options: GlobalCLIOptions) {
  const ret = { ...options }
  delete ret['--']
  delete ret.debug
  delete ret.d
  delete ret.filter
  delete ret.f
  delete ret.config
  delete ret.c
  delete ret.root
  delete ret.r
  delete ret.mode
  delete ret.m
  delete ret.logLevel
  delete ret.l
  delete ret.clearScreen
  return ret
}

cli
  .option('-c, --config <file>', `[string] use specified config file`)
  .option('-r, --root <path>', `[string] use specified root directory`)
  .option('-l, --logLevel <level>', `[string] silent | error | warn | all`)
  .option('--clearScreen', `[boolean] allow/disable clear screen when logging`)
  .option('-d, --debug [feat]', `[string | boolean] show debug logs`)
  .option('-f, --filter <filter>', `[string] filter debug logs`)

// dev
cli
  .command('[root]') // default command
  .alias('serve')
  .option('--host <host>', `[string] specify hostname`)
  .option('--port <port>', `[number] specify port`)
  .option('--https', `[boolean] use TLS + HTTP/2`)
  .option('--open [browser]', `[boolean | string] open browser on startup`)
  .option('--cors', `[boolean] enable CORS`)
  .option('--strictPort', `[boolean] exit if specified port is already in use`)
  .option('-m, --mode <mode>', `[string] set env mode`)
  .option(
    '--force',
    `[boolean] force the optimizer to ignore the cache and re-bundle`
  )
  .action(async (root: string, options: ServerOptions & GlobalCLIOptions) => {
    // output structure is preserved even after bundling so require()
    // is ok here
    const { createServer } = await import('./server')
    try {
      const server = await createServer({
        root,
        mode: options.mode,
        configFile: options.config,
        logLevel: options.logLevel,
        clearScreen: options.clearScreen,
        server: cleanOptions(options) as ServerOptions
      })
      await server.listen()
    } catch (e) {
      createLogger(options.logLevel).error(
        chalk.red(`error when starting dev server:\n${e.stack}`)
      )
      process.exit(1)
    }
  })

// build
cli
  .command('build [root]')
  .option('--base <path>', `[string] public base path (default: /)`)
  .option('--target <target>', `[string] transpile target (default: 'modules')`)
  .option('--outDir <dir>', `[string] output directory (default: dist)`)
  .option(
    '--assetsDir <dir>',
    `[string] directory under outDir to place assets in (default: _assets)`
  )
  .option(
    '--assetsInlineLimit <number>',
    `[number] static asset base64 inline threshold in bytes (default: 4096)`
  )
  .option(
    '--ssr <entry>',
    `[string] build specified entry for server-side rendering`
  )
  .option(
    '--sourcemap',
    `[boolean] output source maps for build (default: false)`
  )
  .option(
    '--minify [minifier]',
    `[boolean | "terser" | "esbuild"] enable/disable minification, ` +
      `or specify minifier to use (default: terser)`
  )
  .option('--manifest', `[boolean] emit build manifest json`)
  .option('--ssrManifest', `[boolean] emit ssr manifest json`)
  .option(
    '--emptyOutDir',
    `[boolean] force empty outDir when it's outside of root`
  )
  .option('-m, --mode <mode>', `[string] set env mode`)
  .action(async (root: string, options: BuildOptions & GlobalCLIOptions) => {
    const { build } = await import('./build')
    const buildOptions = cleanOptions(options) as BuildOptions

    if (buildOptions.ssr) {
      buildOptions.rollupOptions = {
        ...buildOptions.rollupOptions,
        input: (buildOptions.ssr as any) as string
      }
      buildOptions.ssr = true
    }

    try {
      await build({
        root,
        mode: options.mode,
        configFile: options.config,
        logLevel: options.logLevel,
        clearScreen: options.clearScreen,
        build: buildOptions
      })
    } catch (e) {
      createLogger(options.logLevel).error(
        chalk.red(`error during build:\n${e.stack}`)
      )
      process.exit(1)
    }
  })

// optimize
cli
  .command('optimize [root]')
  .option(
    '--force',
    `[boolean] force the optimizer to ignore the cache and re-bundle`
  )
  .action(
    async (root: string, options: { force?: boolean } & GlobalCLIOptions) => {
      const { optimizeDeps } = await import('./optimizer')
      try {
        const config = await resolveConfig(
          {
            root,
            configFile: options.config,
            logLevel: options.logLevel
          },
          'build',
          'development'
        )
        await optimizeDeps(config, options.force, true)
      } catch (e) {
        createLogger(options.logLevel).error(
          chalk.red(`error when optimizing deps:\n${e.stack}`)
        )
        process.exit(1)
      }
    }
  )

cli.help()
cli.version(require('../../package.json').version)

cli.parse()
