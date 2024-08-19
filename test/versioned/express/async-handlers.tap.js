/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { makeRequest, setup } = require('./utils')
const { test } = require('tap')

test('should properly track async handlers', (t) => {
  setup(t)
  const { app } = t.context
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

  runTest(t, '/test', (tx) => {
    const [children] = tx.trace.root.children
    const [mw, handler] = children.children
    t.ok(
      Math.ceil(mw.getDurationInMillis()) >= mwTimeout,
      `should be at least ${mwTimeout} for middleware segment`
    )
    t.ok(
      Math.ceil(handler.getDurationInMillis()) >= handlerTimeout,
      `should be at least ${handlerTimeout} for handler segment`
    )
    t.end()
  })
})

test('should properly handle errors in async handlers', (t) => {
  setup(t)
  const { app } = t.context

  app.use(() => {
    return Promise.reject(new Error('whoops i failed'))
  })
  app.use('/test', function handler(req, res) {
    t.fail('should not call handler on error')
    res.send('ok')
  })
  // eslint-disable-next-line no-unused-vars
  app.use(function (error, req, res, next) {
    res.status(400).end()
  })

  runTest(t, '/test', (tx) => {
    const errors = tx.agent.errors.traceAggregator.errors
    t.equal(errors.length, 1)
    const [error] = errors
    t.equal(error[2], 'HttpError 400', 'should return 400 from custom error handler')
    t.end()
  })
})

function runTest(t, endpoint, callback) {
  const { agent, app } = t.context

  agent.on('transactionFinished', callback)

  const server = app.listen(function () {
    makeRequest(this, endpoint, function (response) {
      response.resume()
    })
  })

  t.teardown(() => {
    server.close()
  })
}
