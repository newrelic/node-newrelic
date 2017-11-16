'use strict'

var helper = require('../../lib/agent_helper')
var shared = require('./shared')


var suite = shared.makeSuite('Promises')
shared.tests.forEach(function registerTest(testFn) {
  suite.add({
    defer: true,
    name: testFn.name,
    fn: testFn(Promise),
    agent: {
      feature_flag: {
        await_support: false
      }
    }
  })
})

suite.run()
