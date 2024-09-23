/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const { setup, teardown } = require('./utils')

test.beforeEach(async (ctx) => {
  await setup(ctx)
})

test.afterEach(teardown)

test('should name middleware correctly', function (t) {
  const { app } = t.nr
  app.use('/', testMiddleware)

  const router = app._router || app.router
  const mwLayer = router.stack.filter((layer) => layer.name === 'testMiddleware')
  assert.equal(mwLayer.length, 1, 'should only find one testMiddleware function')
  function testMiddleware(req, res, next) {
    next()
  }
})
