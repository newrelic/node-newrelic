'use strict'

var test = require('tap').test

test('Multiple require("newrelic")', function(t) {
  process.env.NEW_RELIC_ENABLED = false

  var path = require.resolve('../../../index.js')
  var first = require(path)

  delete require.cache[path]

  var second = require(path)

  t.equal(first, second)
  t.end()
})
