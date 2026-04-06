/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('node:test')
const assert = require('node:assert')
const GoogleGenAiLlmErrorMessage = require('#agentlib/llm-events/google-genai/error-message.js')

test('LlmErrorMessage - cause message ok', async () => {
  // Responses are empty when there is an error
  // in Google GenAI
  const res = {}
  const cause = {
    name: 'ServerError',
    message: 'got status: INTERNAL. {"error":{"status":"INTERNAL","code":500,"message":"some error"}}'
  }
  const errorMsg = new GoogleGenAiLlmErrorMessage({ response: res, cause })
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

test('LlmErrorMessage - cause message invalid json', async () => {
  // Responses are empty when there is an error
  // in Google GenAI
  const res = {}
  const cause = {
    name: 'ServerError',
    message: '{bad:"json"'
  }
  const errorMsg = new GoogleGenAiLlmErrorMessage({ response: res, cause })
  assert.ok(errorMsg.toString(), 'LlmErrorMessage')
  assert.equal(errorMsg['http.statusCode'], undefined)
  assert.match(errorMsg['error.message'], /^failed to parse cause.message: .+/)
  assert.equal(errorMsg['error.code'], undefined)
  assert.equal(errorMsg['error.param'], undefined)
  assert.equal(errorMsg.completion_id, undefined)
  assert.equal(errorMsg.embedding_id, undefined)
  assert.equal(errorMsg.vector_store_id, undefined)
  assert.equal(errorMsg.tool_id, undefined)
})
