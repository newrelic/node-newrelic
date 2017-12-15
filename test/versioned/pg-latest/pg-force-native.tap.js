'use strict'

var runTests = require('./pg.common.js')
var semver = require('semver')

// Latest pg (v7) does not work with instrumentation on node versions
// below 5.0.0, due to necessary usage of rest/spread operators
if (semver.satisfies(process.version, '<5.0.0')) {
  process.exit(0)
}

runTests('forced native', function getClient() {
  // setting env var for forcing native
  process.env.NODE_PG_FORCE_NATIVE = true
  var pg = require('pg')
  delete process.env.NODE_PG_FORCE_NATIVE
  return pg
})
