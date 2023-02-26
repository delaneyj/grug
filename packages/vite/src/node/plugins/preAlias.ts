import { grugDevServer } from '..'
import { Plugin } from '../plugin'
import { bareImportRE } from '../utils'
import { tryOptimizedResolve } from './resolve'

/**
 * A plugin to avoid an aliased AND optimized dep from being aliased in src
 */
export function preAliasPlugin(): Plugin {
  let server: grugDevServer
  return {
    name: 'grug:pre-alias',
    configureServer(_server) {
      server = _server
    },
    resolveId(id) {
      if (bareImportRE.test(id)) {
        return tryOptimizedResolve(id, server)
      }
    }
  }
}
