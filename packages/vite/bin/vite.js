#!/usr/bin/env node

if (!__dirname.includes('node_modules')) {
  try {
    // only available as dev dependency
    require('source-map-support').install()
  } catch (e) {}
}

global.__grug_start_time = Date.now()

// check debug mode first before requiring the CLI.
const debugIndex = process.argv.indexOf('--debug')
const filterIndex = process.argv.indexOf('--filter')
const profileIndex = process.argv.indexOf('--profile')

if (debugIndex > 0) {
  let value = process.argv[debugIndex + 1]
  if (!value || value.startsWith('-')) {
    value = 'grug:*'
  } else {
    // support debugging multiple flags with comma-separated list
    value = value
      .split(',')
      .map((v) => `grug:${v}`)
      .join(',')
  }
  process.env.DEBUG = value

  if (filterIndex > 0) {
    const filter = process.argv[filterIndex + 1]
    if (filter && !filter.startsWith('-')) {
      process.env.grug_DEBUG_FILTER = filter
    }
  }
}

function start() {
  require('../dist/node/cli')
}

if (profileIndex > 0) {
  process.argv.splice(profileIndex, 1)
  const next = process.argv[profileIndex]
  if (next && !next.startsWith('-')) {
    process.argv.splice(profileIndex, 1)
  }
  const inspector = require('inspector')
  const session = (global.__grug_profile_session = new inspector.Session())
  session.connect()
  session.post('Profiler.enable', () => {
    session.post('Profiler.start', start)
  })
} else {
  start()
}
