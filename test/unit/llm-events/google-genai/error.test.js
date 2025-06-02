/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('node:test')
const assert = require('node:assert')
const LlmErrorMessage = require('#agentlib/llm-events/error-message.js')
const { req } = require('./common')

test('LlmErrorMessage', async () => {
  // Responses are empty when there is an error
  // in Google GenAI
  const res = {}
  const cause = {
    name: 'ServerError',
    message: 'got status: INTERNAL. {"error":{"status":"INTERNAL","code":500,"message":"some error"}}'
  }
  const summary = { vendor: 'gemini' }
  const errorMsg = new LlmErrorMessage({ request: req, response: res, cause, summary })
  const expected = {
    'http.statusCode': 500,
    'error.message': 'got status: INTERNAL. {"error":{"status":"INTERNAL","code":500,"message":"some error"}}',
    'error.code': 500,
    'error.param': undefined,
    completion_id: undefined,
    embedding_id: undefined,
    vector_store_id: undefined,
    tool_id: undefined
  }
  assert.ok(errorMsg.toString(), 'LlmErrorMessage')
  assert.equal(errorMsg['http.statusCode'], expected['http.statusCode'])
  assert.equal(errorMsg['error.message'], expected['error.message'])
  assert.equal(errorMsg['error.code'], expected['error.code'])
  assert.equal(errorMsg['error.param'], expected['error.param'])
  assert.equal(errorMsg.completion_id, expected.completion_id)
  assert.equal(errorMsg.embedding_id, expected.embedding_id)
  assert.equal(errorMsg.vector_store_id, expected.vector_store_id)
  assert.equal(errorMsg.tool_id, expected.tool_id)
})
