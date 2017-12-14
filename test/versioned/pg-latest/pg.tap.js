'use strict'

var runTests = require('./pg.common.js')
var semver = require('semver')

if (semver.satisfies(process.version, '<4.0.0')) {
  return
}

runTests('pure JavaScript', function getClient() {
  return require('pg')
})
