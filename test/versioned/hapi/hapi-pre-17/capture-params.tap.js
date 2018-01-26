'use strict'

// run capture params tests
var runTests = require('../../../integration/instrumentation/hapi/capture-params')
var utils = require('./hapi-utils')

runTests(function() {
  return utils.getServer()
})
