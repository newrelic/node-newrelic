/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tsplan = require('@matteo.collina/tspl')
const test = require('node:test')
const helper = require('../../lib/agent_helper')

test('new relic should not break route iteration', async function (t) {
  const plan = tsplan(t, { plan: 1 })
  helper.loadTestAgent(t)
  const express = require('express')
  const router = new express.Router()
  const childA = new express.Router()
  const childB = new express.Router()

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

  plan.deepEqual(findAllRoutes(router, ''), ['/get', ['/test'], ['/hello']])
  plan.end()
})

function findAllRoutes(router, path) {
  if (!router.stack) {
    return path
  }

  return router.stack.map(function (routerr) {
    return findAllRoutes(routerr.handle, path + ((routerr.route && routerr.route.path) || ''))
  })
}
