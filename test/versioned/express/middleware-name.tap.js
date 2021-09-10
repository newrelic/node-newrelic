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
    t.equal(app._router.stack.length, 3, '3 middleware functions: query parser, Express, router')

    let count = 0
    for (let i = 0; i < app._router.stack.length; i++) {
      const layer = app._router.stack[i]

      // route middleware doesn't have a name, sentinel is our error handler,
      // neither should be wrapped.
      if (layer.handle.name && layer.handle.name === 'testMiddleware') {
        count++
      }
    }
    t.equal(count, 1, 'should find only one testMiddleware function')
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
