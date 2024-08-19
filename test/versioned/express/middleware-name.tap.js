/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const helper = require('../../lib/agent_helper')

test('should name middleware correctly', function (t) {
  const agent = helper.instrumentMockedAgent()

  const app = require('express')()

  app.use('/', testMiddleware)

  const server = app.listen(0, function () {
    const router = app._router || app.router
    const mwLayer = router.stack.filter((layer) => layer.name === 'testMiddleware')
    t.equal(mwLayer.length, 1, 'should only find one testMiddleware function')
    t.end()
  })

  t.teardown(function () {
    server.close()
    helper.unloadAgent(agent)
  })

  function testMiddleware(req, res, next) {
    next()
  }
})
