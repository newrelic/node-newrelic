'use strict'

// hapi 10.x and higher works on Node 4 and higher
var semver = require('semver')
if (semver.satisfies(process.versions.node, '<4.0')) return

// run capture params tests
var runTests = require('../../integration/instrumentation/hapi/capture-params.js')
runTests(function createServer(host, port) {
  var hapi = require('hapi')
  var server = new hapi.Server()
  server.connection({
    host: host,
    port: port
  })
  return server
})
