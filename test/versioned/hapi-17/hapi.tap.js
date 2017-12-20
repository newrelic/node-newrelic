'use strict'

var shims = require('../../../lib/shim')
var test = require('tap').test
var helper = require('../../lib/agent_helper')
var instrument = require('../../../lib/instrumentation/hapi')
var conditions = require('./conditions')

test("instrumentation of Hapi", conditions, function(t) {
  t.autoend()

  t.test("preserves hapi.Server() return", function(t) {
    var agent = helper.loadMockedAgent()

    // check if Hapi is returning from function call
    var hapi   = require('hapi')
    var server = new hapi.Server()

    t.ok(server != null, 'Hapi returns from new hapi.Server()')

    var shim = new shims.WebFrameworkShim(agent, 'hapi')
    instrument(agent, hapi, 'hapi', shim)

    var server2 = new hapi.Server()

    t.ok(server2 != null, 'new hapi.Server() returns when instrumented')

    t.end()
  })
})
