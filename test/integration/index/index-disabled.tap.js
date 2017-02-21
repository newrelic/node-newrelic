'use strict'

var test = require('tap').test


test('loading the application via index.js with agent disabled', function(t) {
  t.plan(2)

  process.env.NEW_RELIC_HOME = __dirname + '/..'
  process.env.NEW_RELIC_ENABLED = 'false'
  var api = require('../../../index.js')

  t.ok(api, 'should have an API')
  t.notOk(api.agent, 'should not have an associated agent')
})
