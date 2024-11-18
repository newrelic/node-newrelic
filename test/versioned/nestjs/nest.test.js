/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const { removeMatchedModules } = require('../../lib/cache-buster')
const { promisify } = require('node:util')
const makeRequest = promisify(helper.makeGetRequest)
const { initNestApp, deleteNestApp } = require('./setup')

test('Nest.js', async (t) => {
  const port = 8972 // chosen by rand(), guaranteed to be random
  const baseUrl = `http://localhost:${port}`
  await initNestApp()
  const agent = helper.instrumentMockedAgent()
  const { bootstrap } = require('./test-app/dist/main.js')
  const app = await bootstrap(port)

  t.after(async () => {
    app.close()
    helper.unloadAgent(agent)
    removeMatchedModules(/test-app/)
    await deleteNestApp()
  })

  await t.test('should record a transaction in the base case', async () => {
    const res = await makeRequest(baseUrl)
    assert.equal(res.body, 'Hello World!', 'should greet the world')
    assert.equal(res.statusCode, 200, 'should return 200 status')
    assert.equal(
      agent.metrics.getMetric('WebTransaction').callCount,
      1,
      'should have recorded one web transaction'
    )
  })

  await t.test('should catch stack traces in errors', async () => {
    const res = await makeRequest(`${baseUrl}?please_error=yes`)
    assert.equal(res.statusCode, 500, 'should return 500 status')
    const errors = agent.errors.traceAggregator.errors
    assert.equal(errors.length, 1, 'there should be one error')
    assert.equal(errors[0][2], 'erroring out, as requested', 'should get the expected error')
    assert.ok(errors[0][4].stack_trace, 'should have the stack trace')
  })
})
