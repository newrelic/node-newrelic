/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')


test("new relic should not break route iteration", function(t) {
  t.plan(1)
  var agent = helper.instrumentMockedAgent()
  var express = require('express')
  var router = new express.Router()
  var childA = new express.Router()
  var childB = new express.Router()


  t.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
  })

  router.get('/get', function(req, res) {
    res.end()
  })

  childA.get('/test', function(req, res) {
    res.end()
  })

  childB.get('/hello', function(req, res) {
    res.end()
  })

  router.use(childA)
  router.use(childB)

  t.deepEqual(findAllRoutes(router, ''), ['/get', ['/test'], ['/hello']])
})

function findAllRoutes(router, path) {
  if (!router.stack) {
    return path
  }

  return router.stack.map(function(routerr) {
    return findAllRoutes(
      routerr.handle, path + (routerr.route && routerr.route.path || '')
    )
  })
}
