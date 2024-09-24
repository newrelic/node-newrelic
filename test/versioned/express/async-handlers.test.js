/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const { makeRequest, setup, isExpress5, teardown } = require('./utils')

test('async handlers', { skip: !isExpress5() }, async (t) => {
  t.beforeEach(async (ctx) => {
    await setup(ctx)
  })

  t.afterEach(teardown)

  await t.test('should properly track async handlers', async (t) => {
    const { app } = t.nr
    const mwTimeout = 20
    const handlerTimeout = 25

    app.use(async function (req, res, next) {
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve()
        }, mwTimeout)
      })
      next()
    })
    app.use('/test', async function handler(req, res) {
      await new Promise((resolve) => {
        setTimeout(resolve, handlerTimeout)
      })
      res.send('ok')
    })

    const tx = await runTest(t, '/test')
    const [children] = tx.trace.root.children
    const [mw, handler] = children.children
    assert.ok(
      Math.ceil(mw.getDurationInMillis()) >= mwTimeout,
      `should be at least ${mwTimeout} for middleware segment`
    )
    assert.ok(
      Math.ceil(handler.getDurationInMillis()) >= handlerTimeout,
      `should be at least ${handlerTimeout} for handler segment`
    )
  })

  await test('should properly handle errors in async handlers', async (t) => {
    const { app } = t.nr

    app.use(() => {
      return Promise.reject(new Error('whoops i failed'))
    })
    app.use('/test', function handler() {
      throw new Error('should not call handler on error')
    })
    // eslint-disable-next-line no-unused-vars
    app.use(function (error, req, res, next) {
      res.status(400).end()
    })

    const tx = await runTest(t, '/test')
    const errors = tx.agent.errors.traceAggregator.errors
    assert.equal(errors.length, 1)
    const [error] = errors
    assert.equal(error[2], 'HttpError 400', 'should return 400 from custom error handler')
  })
})

async function runTest(t, endpoint) {
  const { agent, port } = t.nr
  return new Promise((resolve) => {
    agent.on('transactionFinished', resolve)

    makeRequest(port, endpoint, function (response) {
      response.resume()
    })
  })
}
