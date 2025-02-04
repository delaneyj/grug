import debug from 'debug'
import chalk from 'chalk'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { parse as parseUrl } from 'url'
import slash from 'slash'
import { FS_PREFIX, SUPPORTED_EXTS } from './constants'
import resolve from 'resolve'

export const bareImportRE = /^[\w@]/
export const deepImportRE = /^([^@][^/]*)\/|^(@[^/]+\/[^/]+)\//

let isRunningWithYarnPnp: boolean
try {
  isRunningWithYarnPnp = Boolean(require('pnpapi'))
} catch {}

export function resolveFrom(id: string, basedir: string) {
  return resolve.sync(id, {
    basedir,
    extensions: SUPPORTED_EXTS,
    // necessary to work with pnpm
    preserveSymlinks: isRunningWithYarnPnp || false
  })
}

// set in bin/grug.js
const filter = process.env.grug_DEBUG_FILTER

const DEBUG = process.env.DEBUG

interface DebuggerOptions {
  onlyWhenFocused?: boolean | string
}

export function createDebugger(ns: string, options: DebuggerOptions = {}) {
  const log = debug(ns)
  const { onlyWhenFocused } = options
  const focus = typeof onlyWhenFocused === 'string' ? onlyWhenFocused : ns
  return (msg: string, ...args: any[]) => {
    if (filter && !msg.includes(filter)) {
      return
    }
    if (onlyWhenFocused && !DEBUG?.includes(focus)) {
      return
    }
    log(msg, ...args)
  }
}

const isWindows = os.platform() === 'win32'
const VOLUME_RE = /^[A-Z]:/i

export function normalizePath(id: string): string {
  if (isWindows) {
    return path.posix.normalize(slash(id.replace(VOLUME_RE, '')))
  }
  return path.posix.normalize(id)
}

export function fsPathFromId(id: string): string {
  const fsPath = normalizePath(id.slice(FS_PREFIX.length))
  return fsPath.startsWith('/') ? fsPath : `/${fsPath}`
}

export const queryRE = /\?.*$/
export const hashRE = /#.*$/

export const cleanUrl = (url: string) =>
  url.replace(hashRE, '').replace(queryRE, '')

const externalRE = /^(https?:)?\/\//
export const isExternalUrl = (url: string) => externalRE.test(url)

const dataUrlRE = /^\s*data:/i
export const isDataUrl = (url: string) => dataUrlRE.test(url)

const knownJsSrcRE = /\.((j|t)sx?|mjs|vue)($|\?)/
export const isJSRequest = (url: string) => {
  if (knownJsSrcRE.test(url)) {
    return true
  }
  url = cleanUrl(url)
  if (!path.extname(url) && !url.endsWith('/')) {
    return true
  }
  return false
}

const importQueryRE = /(\?|&)import(&|$)/
export const isImportRequest = (url: string) => importQueryRE.test(url)

export function removeImportQuery(url: string) {
  return url.replace(importQueryRE, '$1').replace(/\?$/, '')
}

export function injectQuery(url: string, queryToInject: string) {
  const { pathname, search, hash } = parseUrl(url)
  return `${pathname}?${queryToInject}${search ? `&` + search.slice(1) : ''}${
    hash || ''
  }`
}

export function removeTimestampQuery(url: string) {
  return url.replace(/\bt=\d{13}&?\b/, '').replace(/\?$/, '')
}

export async function asyncReplace(
  input: string,
  re: RegExp,
  replacer: (match: RegExpExecArray) => string | Promise<string>
) {
  let match: RegExpExecArray | null
  let remaining = input
  let rewritten = ''
  while ((match = re.exec(remaining))) {
    rewritten += remaining.slice(0, match.index)
    rewritten += await replacer(match)
    remaining = remaining.slice(match.index + match[0].length)
  }
  rewritten += remaining
  return rewritten
}

export function timeFrom(start: number, subtract = 0) {
  const time: number | string = Date.now() - start - subtract
  const timeString = (time + `ms`).padEnd(5, ' ')
  if (time < 10) {
    return chalk.green(timeString)
  } else if (time < 50) {
    return chalk.yellow(timeString)
  } else {
    return chalk.red(timeString)
  }
}

/**
 * pretty url for logging.
 */
export function prettifyUrl(url: string, root: string) {
  url = removeTimestampQuery(url)
  const isAbsoluteFile = url.startsWith(root)
  if (isAbsoluteFile || url.startsWith(FS_PREFIX)) {
    let file = path.relative(
      root,
      isAbsoluteFile ? url : url.slice(FS_PREFIX.length)
    )
    const seg = file.split('/')
    const npmIndex = seg.indexOf(`node_modules`)
    const isSourceMap = file.endsWith('.map')
    if (npmIndex > 0) {
      file = seg[npmIndex + 1]
      if (file.startsWith('@')) {
        file = `${file}/${seg[npmIndex + 2]}`
      }
      file = `npm: ${chalk.dim(file)}${isSourceMap ? ` (source map)` : ``}`
    }
    return chalk.dim(file)
  } else {
    return chalk.dim(url)
  }
}

export function isObject(value: unknown): value is Record<string, any> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

export function lookupFile(
  dir: string,
  formats: string[],
  pathOnly = false
): string | undefined {
  for (const format of formats) {
    const fullPath = path.join(dir, format)
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return pathOnly ? fullPath : fs.readFileSync(fullPath, 'utf-8')
    }
  }
  const parentDir = path.dirname(dir)
  if (parentDir !== dir) {
    return lookupFile(parentDir, formats, pathOnly)
  }
}

const splitRE = /\r?\n/

const range: number = 2

export function pad(source: string, n = 2) {
  const lines = source.split(splitRE)
  return lines.map((l) => ` `.repeat(n) + l).join(`\n`)
}

export function posToNumber(
  source: string,
  pos: number | { line: number; column: number }
): number {
  if (typeof pos === 'number') return pos
  const lines = source.split(splitRE)
  const { line, column } = pos
  let start = 0
  for (let i = 0; i < line - 1; i++) {
    start += lines[i].length + 1
  }
  return start + column
}

export function numberToPos(
  source: string,
  offset: number | { line: number; column: number }
) {
  if (typeof offset !== 'number') return offset
  if (offset > source.length) {
    throw new Error('offset is longer than source length!')
  }
  const lines = source.split(splitRE)
  let counted = 0
  let line = 0
  let column = 0
  for (; line < lines.length; line++) {
    const lineLength = lines[line].length + 1
    if (counted + lineLength >= offset) {
      column = offset - counted + 1
      break
    }
    counted += lineLength
  }
  return { line: line + 1, column }
}

export function generateCodeFrame(
  source: string,
  start: number | { line: number; column: number } = 0,
  end?: number
): string {
  start = posToNumber(source, start)
  end = end || start
  const lines = source.split(splitRE)
  let count = 0
  const res: string[] = []
  for (let i = 0; i < lines.length; i++) {
    count += lines[i].length + 1
    if (count >= start) {
      for (let j = i - range; j <= i + range || end > count; j++) {
        if (j < 0 || j >= lines.length) continue
        const line = j + 1
        res.push(
          `${line}${' '.repeat(Math.max(3 - String(line).length, 0))}|  ${
            lines[j]
          }`
        )
        const lineLength = lines[j].length
        if (j === i) {
          // push underline
          const pad = start - (count - lineLength) + 1
          const length = Math.max(
            1,
            end > count ? lineLength - pad : end - start
          )
          res.push(`   |  ` + ' '.repeat(pad) + '^'.repeat(length))
        } else if (j > i) {
          if (end > count) {
            const length = Math.max(Math.min(end - count, lineLength), 1)
            res.push(`   |  ` + '^'.repeat(length))
          }
          count += lineLength + 1
        }
      }
      break
    }
  }
  return res.join('\n')
}

export function writeFile(filename: string, content: string | Uint8Array) {
  const dir = path.dirname(filename)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filename, content)
}

export function emptyDir(dir: string) {
  if (!fs.existsSync(dir)) {
    return
  }
  for (const file of fs.readdirSync(dir)) {
    const abs = path.resolve(dir, file)
    // baseline is Node 12 so can't use rmSync :(
    if (fs.lstatSync(abs).isDirectory()) {
      emptyDir(abs)
      fs.rmdirSync(abs)
    } else {
      fs.unlinkSync(abs)
    }
  }
}

export function copyDir(srcDir: string, destDir: string) {
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.resolve(srcDir, file)
    const destFile = path.resolve(destDir, file)
    const stat = fs.statSync(srcFile)
    if (stat.isDirectory()) {
      copyDir(srcFile, destFile)
    } else {
      fs.copyFileSync(srcFile, destFile)
    }
  }
}
