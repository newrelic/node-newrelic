/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const helper = require('../../lib/agent_helper')

test('new relic should not break route iteration', function (t) {
  t.plan(1)
  const agent = helper.instrumentMockedAgent()
  const express = require('express')
  const router = new express.Router()
  const childA = new express.Router()
  const childB = new express.Router()

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  router.get('/get', function (req, res) {
    res.end()
  })

  childA.get('/test', function (req, res) {
    res.end()
  })

  childB.get('/hello', function (req, res) {
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

  return router.stack.map(function (routerr) {
    return findAllRoutes(routerr.handle, path + ((routerr.route && routerr.route.path) || ''))
  })
}
