/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const ConverseResponse = require('../../../../lib/llm-events/aws-bedrock/converse-response')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.response = {
    response: {
      statusCode: 200,
      headers: {
        'x-amzn-requestid': 'aws-request-1',
        'x-foo': 'foo'
      }
    },
    output: {
      output: {
        message: { content: [{ text: 'Hello world' }] }
      },
      stopReason: 'done',
      usage: {
        inputTokens: 42,
        outputTokens: 58,
        totalTokens: 100
      }
    }
  }
})

test('minimal converse response works', (t) => {
  const res = new ConverseResponse(t.nr)
  assert.deepStrictEqual(res.completions, ['Hello world'])
  assert.equal(res.finishReason, 'done')
  assert.deepStrictEqual(res.headers, t.nr.response.response.headers)
  assert.equal(res.id, 'aws-request-1')
  assert.equal(res.requestId, 'aws-request-1')
  assert.equal(res.statusCode, 200)
})

test('malformed response is handled gracefully', (t) => {
  t.nr.response.output.output.message = {}
  const res = new ConverseResponse(t.nr)
  assert.deepStrictEqual(res.completions, [])
})

test('should only set data from raw response on error', (t) => {
  t.nr.response.$response = { ...t.nr.response.response }
  delete t.nr.response.response
  delete t.nr.response.output
  t.nr.isError = true
  const res = new ConverseResponse(t.nr)
  assert.deepStrictEqual(res.completions, [])
  assert.equal(res.finishReason, undefined)
  assert.deepStrictEqual(res.headers, t.nr.response.$response.headers)
  assert.equal(res.requestId, 'aws-request-1')
  assert.equal(res.statusCode, 200)
})

test('inputTokenCount', (t) => {
  const res = new ConverseResponse(t.nr)
  assert.equal(res.inputTokenCount, 42)
})

test('outputTokenCount', (t) => {
  const res = new ConverseResponse(t.nr)
  assert.equal(res.outputTokenCount, 58)
})

test('totalTokenCount', (t) => {
  const res = new ConverseResponse(t.nr)
  assert.equal(res.totalTokenCount, 100)
})
