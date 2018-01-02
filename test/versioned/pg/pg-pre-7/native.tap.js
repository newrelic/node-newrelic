'use strict'

var runTests = require('./pg.common.js')
var semver = require('semver')

if (semver.satisfies(process.version, '<4.0.0')) {
  return
}

runTests('native', function getClient() {
  return require('pg').native
})
