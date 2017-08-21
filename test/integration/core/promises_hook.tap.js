'use strict'

var semver = require('semver')

if (!(semver.satisfies(process.version, '>=8') || semver.prerelease(process.version))) {
  console.error(
    'async hook promise instrumentation requires both native promises and async hooks'
  )
  return
}

require('./promises.js')({await_support: true})
