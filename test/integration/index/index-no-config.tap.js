'use strict'

var test = require('tap').test


test('loading the application via index.js with agent disabled', function(t) {
  t.plan(3)

  process.env.NEW_RELIC_HOME = '/this/is/not/a/real/path'
  process.env.HOME = '/this/is/also/not/a/real/path'
  process.cwd = function() {
    return __dirname
  }
  var api
  t.doesNotThrow(function() {
    api = require('../../../')
  }, 'should not die when the config file is not found')

  t.ok(api, 'should have an API')
  t.notOk(api.agent, 'should not have an associated agent')
})
