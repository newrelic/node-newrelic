/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const assertPackageMetrics = require('../../lib/custom-assertions/assert-pkg-tracking-metrics.js')
const helper = require('../../lib/agent_helper')
const { removeMatchedModules } = require('../../lib/cache-buster')
const { initNestApp, deleteNestApp } = require('./setup')

const makeRequest = helper.asyncHttpCall

let appInitialized = false
test.beforeEach(async (ctx) => {
  if (appInitialized === false) {
    await initNestApp()
    appInitialized = true
  }

  ctx.nr = {
    agent: helper.instrumentMockedAgent()
  }

  const { bootstrap } = require('./test-app/dist/main.js')
  const app = await bootstrap(0)
  const address = app.httpServer.address()
  const baseUrl = address.family === 'IPv6'
    ? `http://[${address.address}]:${address.port}`
    : `http://${address.address}:${address.port}`

  ctx.nr.app = app
  ctx.nr.address = address
  ctx.nr.baseUrl = baseUrl
})

test.afterEach(async (ctx) => {
  ctx.nr.app.close()
  helper.unloadAgent(ctx.nr.agent)
  removeMatchedModules(/test-app/)
})

test.after(async () => {
  await deleteNestApp()
})

test.test('should log tracking metrics', async function(t) {
  const { agent, baseUrl } = t.nr
  // eslint-disable-next-line sonarjs/no-internal-api-use
  const { version } = require('./test-app/node_modules/@nestjs/core/package.json')
  await makeRequest(`${baseUrl}?please_error=yes`)
  assertPackageMetrics({ agent, pkg: '@nestjs/core', version, subscriberType: true })
})

test('should record a transaction in the base case', async (t) => {
  const { agent, baseUrl } = t.nr
  const { response: res } = await makeRequest(baseUrl)
  assert.equal(res.body, 'Hello World!', 'should greet the world')
  assert.equal(res.statusCode, 200, 'should return 200 status')
  assert.equal(
    agent.metrics.getMetric('WebTransaction').callCount,
    1,
    'should have recorded one web transaction'
  )
})

test('should catch stack traces in errors', async (t) => {
  const { agent, baseUrl } = t.nr
  const { response: res } = await makeRequest(`${baseUrl}?please_error=yes`)
  assert.equal(res.statusCode, 500, 'should return 500 status')
  const errors = agent.errors.traceAggregator.errors
  assert.equal(errors.length, 1, 'there should be one error')
  assert.equal(errors[0][2], 'erroring out, as requested', 'should get the expected error')
  assert.ok(errors[0][4].stack_trace, 'should have the stack trace')
})
