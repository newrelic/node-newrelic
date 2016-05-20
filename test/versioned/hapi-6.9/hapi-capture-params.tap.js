'use strict'

// hapi 10.x and higher works on Node 4 and higher
var semver = require('semver')
if (semver.satisfies(process.versions.node, '<0.10')) return

var hapi = require('hapi')

// run capture params tests
var runTests = require('../../integration/instrumentation/hapi/capture-params.js')
runTests(hapi, function createServer(host, port) {
  return hapi.createServer(host, port)
})
