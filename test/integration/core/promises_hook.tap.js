'use strict'

var semver = require('semver')

if (!(semver.satisfies(process.version, '>=8.2') || semver.prerelease(process.version))) {
  console.error('Promise tests cant run without native Promises')
  return
}

require('./promises.js')({await_support: true})
