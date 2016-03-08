'use strict'

// hapi 10.x and higher works on Node 4 and higher
var semver = require('semver')
if (semver.satisfies(process.versions.node, '<4.0')) return

var test = require('tap').test

var helper = require('../../lib/agent_helper')
var instrument = require('../../../lib/instrumentation/hapi')

test("instrumentation of Hapi", function (t) {

  t.test("preserves Server.connection() return", function (t) {
    var agent = helper.loadMockedAgent()

    // check if Hapi is returning from function call
    var hapi   = require('hapi')
    var server = new hapi.Server()
    var returned = server.connection()

    t.ok(returned != null, 'Hapi returns from Server.connection()')

    instrument(agent, hapi)
    var server2 = new hapi.Server()
    var returned2 = server2.connection()

    t.ok(returned2 != null, 'Server.connection() returns when instrumented')

    t.end()
  })
})

function clearCache(moduleName) {
  var path = require('path')
  var name = require.resolve(moduleName)
  var base = path.dirname(name)
  for (var key in require.cache) {
    if (key.indexOf(base) === 0) {
      delete require.cache[key]
    }
  }
}