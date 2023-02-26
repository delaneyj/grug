import { Plugin } from 'grug'

type PluginFactory = () => Plugin

declare const createPlugin: PluginFactory & { preambleCode: string }

export = createPlugin
