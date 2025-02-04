import fs from 'fs'
import path from 'path'
import { createServer, grugDevServer } from '..'
import { createDebugger, lookupFile, normalizePath } from '../utils'
import { ModuleNode } from './moduleGraph'
import chalk from 'chalk'
import slash from 'slash'
import { Update } from 'types/hmrPayload'
import { CLIENT_DIR } from '../constants'
import { RollupError } from 'rollup'

export const debugHmr = createDebugger('grug:hmr')

const normalizedClientDir = normalizePath(CLIENT_DIR)

export interface HmrOptions {
  protocol?: string
  host?: string
  port?: number
  path?: string
  timeout?: number
  overlay?: boolean
}

export interface HmrContext {
  file: string
  timestamp: number
  modules: Array<ModuleNode>
  read: () => string | Promise<string>
  server: grugDevServer
}

export async function handleHMRUpdate(
  file: string,
  server: grugDevServer
): Promise<any> {
  const { ws, config, moduleGraph } = server
  const shortFile = file.startsWith(config.root + '/')
    ? path.posix.relative(config.root, file)
    : file

  if (file === config.configFile || file.endsWith('.env')) {
    // TODO auto restart server
    debugHmr(`[config change] ${chalk.dim(shortFile)}`)
    config.logger.info(
      chalk.green('config or .env file changed, restarting server...'),
      { clear: true, timestamp: true }
    )
    await restartServer(server)
    return
  }

  if (
    file.endsWith('package.json') &&
    file ===
      normalizePath(lookupFile(config.root, [`package.json`], true) || '')
  ) {
    const deps = require(file).dependencies || {}
    const prevDeps = server._optimizeDepsMetadata?.dependencies || {}
    // check if deps have changed
    if (hasDepsChanged(deps, prevDeps)) {
      config.logger.info(
        chalk.green('dependencies have changed, restarting server...'),
        { clear: true, timestamp: true }
      )
      await restartServer(server)
    }
    return
  }

  debugHmr(`[file change] ${chalk.dim(shortFile)}`)

  // (dev only) the client itself cannot be hot updated.
  if (file.startsWith(normalizedClientDir)) {
    ws.send({
      type: 'full-reload',
      path: '/' + slash(path.relative(config.root, file))
    })
    return
  }

  const mods = moduleGraph.getModulesByFile(file)

  // check if any plugin wants to perform custom HMR handling
  const timestamp = Date.now()
  const hmrContext: HmrContext = {
    file,
    timestamp,
    modules: mods ? [...mods] : [],
    read: () => readModifiedFile(file),
    server
  }

  for (const plugin of config.plugins) {
    if (plugin.handleHotUpdate) {
      const filteredModules = await plugin.handleHotUpdate(hmrContext)
      if (filteredModules) {
        hmrContext.modules = filteredModules
      }
    }
  }

  if (!hmrContext.modules.length) {
    // html file cannot be hot updated
    if (file.endsWith('.html')) {
      config.logger.info(chalk.green(`page reload `) + chalk.dim(shortFile), {
        clear: true,
        timestamp: true
      })
      ws.send({
        type: 'full-reload',
        path: '/' + slash(path.relative(config.root, file))
      })
    } else {
      // loaded but not in the module graph, probably not js
      debugHmr(`[no modules matched] ${chalk.dim(shortFile)}`)
    }
    return
  }

  const updates: Update[] = []
  const invalidatedModules = new Set<ModuleNode>()

  for (const mod of hmrContext.modules) {
    const boundaries = new Set<{
      boundary: ModuleNode
      acceptedVia: ModuleNode
    }>()
    invalidate(mod, timestamp, invalidatedModules)
    const hasDeadEnd = propagateUpdate(mod, timestamp, boundaries)
    if (hasDeadEnd) {
      config.logger.info(chalk.green(`page reload `) + chalk.dim(shortFile), {
        clear: true,
        timestamp: true
      })
      ws.send({
        type: 'full-reload'
      })
      return
    }

    updates.push(
      ...[...boundaries].map(({ boundary, acceptedVia }) => ({
        type: `${boundary.type}-update` as Update['type'],
        timestamp,
        path: boundary.url,
        acceptedPath: acceptedVia.url
      }))
    )
  }

  config.logger.info(
    updates
      .map(({ path }) => chalk.green(`hmr update `) + chalk.dim(path))
      .join('\n'),
    { clear: true, timestamp: true }
  )

  ws.send({
    type: 'update',
    updates
  })
}

function propagateUpdate(
  node: ModuleNode,
  timestamp: number,
  boundaries: Set<{
    boundary: ModuleNode
    acceptedVia: ModuleNode
  }>,
  currentChain: ModuleNode[] = [node]
): boolean /* hasDeadEnd */ {
  if (node.isSelfAccepting) {
    boundaries.add({
      boundary: node,
      acceptedVia: node
    })
    return false
  }

  if (!node.importers.size) {
    return true
  }

  for (const importer of node.importers) {
    const subChain = currentChain.concat(importer)
    if (importer.acceptedHmrDeps.has(node)) {
      boundaries.add({
        boundary: importer,
        acceptedVia: node
      })
      continue
    }

    if (currentChain.includes(importer)) {
      // circular deps is considered dead end
      return true
    }

    if (propagateUpdate(importer, timestamp, boundaries, subChain)) {
      return true
    }
  }
  return false
}

function invalidate(mod: ModuleNode, timestamp: number, seen: Set<ModuleNode>) {
  if (seen.has(mod)) {
    return
  }
  seen.add(mod)
  mod.lastHMRTimestamp = timestamp
  mod.transformResult = null
  mod.importers.forEach((importer) => invalidate(importer, timestamp, seen))
}

export function handlePrunedModules(
  mods: Set<ModuleNode>,
  { ws }: grugDevServer
) {
  // update the disposed modules' hmr timestamp
  // since if it's re-imported, it should re-apply side effects
  // and without the timestamp the browser will not re-import it!
  const t = Date.now()
  mods.forEach((mod) => {
    mod.lastHMRTimestamp = t
    debugHmr(`[dispose] ${chalk.dim(mod.file)}`)
  })
  ws.send({
    type: 'prune',
    paths: [...mods].map((m) => m.url)
  })
}

const enum LexerState {
  inCall,
  inSingleQuoteString,
  inDoubleQuoteString,
  inTemplateString,
  inArray
}

/**
 * Lex import.meta.hot.accept() for accepted deps.
 * Since hot.accept() can only accept string literals or array of string
 * literals, we don't really need a heavy @babel/parse call on the entire source.
 *
 * @returns selfAccepts
 */
export function lexAcceptedHmrDeps(
  code: string,
  start: number,
  urls: Set<{ url: string; start: number; end: number }>
): boolean {
  let state: LexerState = LexerState.inCall
  // the state can only be 2 levels deep so no need for a stack
  let prevState: LexerState = LexerState.inCall
  let currentDep: string = ''

  function addDep(index: number) {
    urls.add({
      url: currentDep,
      start: index - currentDep.length - 1,
      end: index + 1
    })
    currentDep = ''
  }

  for (let i = start; i < code.length; i++) {
    const char = code.charAt(i)
    switch (state) {
      case LexerState.inCall:
      case LexerState.inArray:
        if (char === `'`) {
          prevState = state
          state = LexerState.inSingleQuoteString
        } else if (char === `"`) {
          prevState = state
          state = LexerState.inDoubleQuoteString
        } else if (char === '`') {
          prevState = state
          state = LexerState.inTemplateString
        } else if (/\s/.test(char)) {
          continue
        } else {
          if (state === LexerState.inCall) {
            if (char === `[`) {
              state = LexerState.inArray
            } else {
              // reaching here means the first arg is neither a string literal
              // nor an Array literal (direct callback) or there is no arg
              // in both case this indicates a self-accepting module
              return true // done
            }
          } else if (state === LexerState.inArray) {
            if (char === `]`) {
              return false // done
            } else if (char === ',') {
              continue
            } else {
              error(i)
            }
          }
        }
        break
      case LexerState.inSingleQuoteString:
        if (char === `'`) {
          addDep(i)
          if (prevState === LexerState.inCall) {
            // accept('foo', ...)
            return false
          } else {
            state = prevState
          }
        } else {
          currentDep += char
        }
        break
      case LexerState.inDoubleQuoteString:
        if (char === `"`) {
          addDep(i)
          if (prevState === LexerState.inCall) {
            // accept('foo', ...)
            return false
          } else {
            state = prevState
          }
        } else {
          currentDep += char
        }
        break
      case LexerState.inTemplateString:
        if (char === '`') {
          addDep(i)
          if (prevState === LexerState.inCall) {
            // accept('foo', ...)
            return false
          } else {
            state = prevState
          }
        } else if (char === '$' && code.charAt(i + 1) === '{') {
          error(i)
        } else {
          currentDep += char
        }
        break
      default:
        throw new Error('unknown import.meta.hot lexer state')
    }
  }
  return false
}

function error(pos: number) {
  const err = new Error(
    `import.meta.accept() can only accept string literals or an ` +
      `Array of string literals.`
  ) as RollupError
  err.pos = pos
  throw err
}

// delaneyj/grug#610 when hot-reloading Vue files, we read immediately on file
// change event and sometimes this can be too early and get an empty buffer.
// Poll until the file's modified time has changed before reading again.
async function readModifiedFile(file: string): Promise<string> {
  const content = fs.readFileSync(file, 'utf-8')
  if (!content) {
    const mtime = fs.statSync(file).mtimeMs
    await new Promise((r) => {
      let n = 0
      const poll = async () => {
        n++
        const newMtime = fs.statSync(file).mtimeMs
        if (newMtime !== mtime || n > 10) {
          r(0)
        } else {
          setTimeout(poll, 10)
        }
      }
      setTimeout(poll, 10)
    })
    return fs.readFileSync(file, 'utf-8')
  } else {
    return content
  }
}

function hasDepsChanged(deps: any, prevDeps: any): boolean {
  if (Object.keys(deps).length !== Object.keys(prevDeps).length) {
    return true
  }
  for (const key in deps) {
    if (deps[key] !== prevDeps[key]) {
      return true
    }
  }
  return false
}

async function restartServer(server: grugDevServer) {
  await server.close()
  ;(global as any).__grug_start_time = Date.now()
  server = await createServer(server.config.inlineConfig)
  await server.listen()
}
