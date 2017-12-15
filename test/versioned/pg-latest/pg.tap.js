'use strict'

var runTests = require('./pg.common.js')
var semver = require('semver')

// Latest pg (v7) does not work with instrumentation on node versions
// below 5.0.0, due to necessary usage of rest/spread operators
if (semver.satisfies(process.version, '<5.0.0')) {
  process.exit(0)
}

runTests('pure JavaScript', function getClient() {
  return require('pg')
})
