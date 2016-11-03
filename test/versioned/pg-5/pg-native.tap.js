'use strict'
// We cant test v0.8 here because pg-native 4 uses stream.Duplex, which doesn't
// exist in v0.8.
var semver = require('semver')
if (semver.satisfies(process.versions.node, '0.8.x')) return

var runTests = require('./pg.common.js')

runTests('native', function getClient() {
  return require('pg').native
})
