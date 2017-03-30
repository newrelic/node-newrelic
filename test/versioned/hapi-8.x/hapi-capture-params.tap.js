'use strict'

var hapi = require('hapi')

// run capture params tests
var runTests = require('../../integration/instrumentation/hapi/capture-params.js')
runTests(hapi, function createServer(host, port) {
  var server = new hapi.Server()
  server.connection({
    host: host,
    port: port
  })
  return server
})
