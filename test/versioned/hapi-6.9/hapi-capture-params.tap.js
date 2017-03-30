'use strict'

var hapi = require('hapi')

// run capture params tests
var runTests = require('../../integration/instrumentation/hapi/capture-params.js')
runTests(hapi, function createServer(host, port) {
  return hapi.createServer(host, port)
})
