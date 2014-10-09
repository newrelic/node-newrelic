'use strict'

var test = require('tap').test
var helper  = require('../../lib/agent_helper')

test('app should be at top of stack when mounted', function (t) {
  var agent = helper.instrumentMockedAgent()
  var express = require('express')

  this.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
  })

  t.plan(2)

  var main = express()
  var child = express()

  child.on('mount', function() {
    t.equal(
      main._router.stack.length,
      3,
      '3 middleware functions: query parser, Express, child'
    )
  })

  main.use(child)

  t.equal(
    main._router.stack.length,
    4,
    '4 middleware functions: query parser, Express, child, error trapper'
  )
})
