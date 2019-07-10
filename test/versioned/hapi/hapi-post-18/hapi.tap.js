'use strict'

var tap = require('tap')
var shims = require('../../../../lib/shim')
var helper = require('../../../lib/agent_helper')
var instrument = require('../../../../lib/instrumentation/hapi')
var utils = require('./hapi-18-utils')

tap.test('instrumentation of Hapi', function(t) {
  t.autoend()

  t.test('preserves server creation return', function(t) {
    var agent = helper.loadMockedAgent()
    var hapi = require('@hapi/hapi')
    var returned = utils.getServer({ hapi: hapi })

    t.ok(returned != null, 'Hapi returns from server creation')

    var shim = new shims.WebFrameworkShim(agent, 'hapi')
    instrument(agent, hapi, 'hapi', shim)

    var returned2 = utils.getServer({ hapi: hapi })

    t.ok(returned2 != null, 'Server creation returns when instrumented')

    t.end()
  })
})
