/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

process.env.NODE_ENV = 'test'

const assert = require('node:assert')
const test = require('node:test')
const { makeRequest, setup, teardown } = require('./utils')

test.beforeEach(async (ctx) => {
  await setup(ctx)
})

test.afterEach(teardown)

test('async middleware at same mount path as router does not duplicate name', async (t) => {
  const { agent, app, express, port } = t.nr

  app.use('/resources/:resourceId', async function (req, res, next) {
    next()
  })

  const router = new express.Router({ mergeParams: true })
  router.get('/:itemId/details', function (req, res) {
    res.end()
  })
  app.use('/resources/:resourceId', router)

  const { promise, resolve } = Promise.withResolvers()
  agent.on('transactionFinished', (tx) => resolve(tx.name))
  makeRequest(port, '/resources/abc/123/details')

  const name = await promise
  assert.equal(name, 'WebTransaction/Expressjs/GET//resources/:resourceId/:itemId/details')
})
