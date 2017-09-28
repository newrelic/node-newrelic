'use strict'

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
