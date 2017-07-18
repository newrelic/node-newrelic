'use strict'

var runTests = require('./pg.common.js')
var semver = require('semver')

if (semver.satisfies(process.version, '<4.0.0')) {
  return
}

runTests('forced native', function getClient() {
  // setting env var for forcing native
  process.env.NODE_PG_FORCE_NATIVE = true
  var pg = require('pg')
  delete process.env.NODE_PG_FORCE_NATIVE
  return pg
})
