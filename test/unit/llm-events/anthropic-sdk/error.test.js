/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { LlmErrorMessage } = require('#agentlib/llm-events/anthropic-sdk/index.js')

// UnprocessableEntityError (422) - e.g. invalid model name
// `cause.error.error` has the nested error details
const error1 = {
  status: 422,
  headers: {
    'content-length': '143',
    'content-type': 'application/json',
    date: 'Mon, 06 Apr 2026 20:17:00 GMT',
    server: 'internal',
    'x-envoy-upstream-service-time': '57',
  },
  request_id: undefined,
  error: {
    error: {
      message: "The given model doesn't exist in the requested endpoint",
      code: 422,
      model: 'invalid-model',
      endpoint: 'chat_completion',
    },
  },
  // This is not a property but a getter on the error cause object,
  // but this is fine for testing purposes.
  message: "422 {\"error\":{\"message\":\"The given model doesn't exist in the requested endpoint\",\"code\":422,\"model\":\"invalid-model\",\"endpoint\":\"chat_completion\"}}"
}

// APIConnectionError - e.g. unreachable host
// `cause.cause` has the underlying system error
const error2 = {
  status: undefined,
  headers: undefined,
  request_id: undefined,
  error: undefined,
  cause: {
    message: 'request to http://10.255.255.1/v1/messages failed, reason: connect ENETUNREACH 10.255.255.1:80',
    type: 'system',
    errno: 'ENETUNREACH',
    code: 'ENETUNREACH',
  },
  // This is not a property but a getter on the error cause object,
  // but this is fine for testing purposes.
  message: 'Connection error.'
}

test('LlmErrorMessage - UnprocessableEntityError (422)', async () => {
  const res = {}
  const summary = { id: 'summary-123' }
  const errorMsg = new LlmErrorMessage({ response: res, cause: error1, summary })
  assert.ok(errorMsg.toString(), 'LlmErrorMessage')
  assert.equal(errorMsg['http.statusCode'], 422)
  assert.equal(errorMsg['error.message'], error1.message)
  assert.equal(errorMsg['error.code'], 422)
  assert.equal(errorMsg.completion_id, 'summary-123')
  assert.equal(errorMsg.embedding_id, undefined)
  assert.equal(errorMsg.vector_store_id, undefined)
  assert.equal(errorMsg.tool_id, undefined)
})

test('LlmErrorMessage - APIConnectionError (cause.cause)', async () => {
  const res = {}
  const errorMsg = new LlmErrorMessage({ response: res, cause: error2 })
  assert.ok(errorMsg.toString(), 'LlmErrorMessage')
  assert.equal(errorMsg['http.statusCode'], undefined)
  // error-message.js overrides to use the more verbose cause.cause.message
  assert.equal(
    errorMsg['error.message'],
    'request to http://10.255.255.1/v1/messages failed, reason: connect ENETUNREACH 10.255.255.1:80'
  )
  assert.equal(errorMsg['error.code'], 'ENETUNREACH')
  assert.equal(errorMsg.completion_id, undefined)
})

test('LlmErrorMessage - sets completion_id from summary', async () => {
  const summary = { id: 'test-summary-id' }
  const errorMsg = new LlmErrorMessage({ response: {}, cause: error1, summary })
  assert.equal(errorMsg.completion_id, 'test-summary-id')
})

test('LlmErrorMessage - handles missing cause gracefully', async () => {
  const errorMsg = new LlmErrorMessage({ response: {} })
  assert.ok(errorMsg.toString(), 'LlmErrorMessage')
  assert.equal(errorMsg['http.statusCode'], undefined)
  assert.equal(errorMsg['error.message'], undefined)
  assert.equal(errorMsg['error.code'], undefined)
  assert.equal(errorMsg.completion_id, undefined)
})

test('LlmErrorMessage - handles cause with no nested error or cause', async () => {
  const cause = {
    status: 400,
    message: 'Bad request',
  }
  const errorMsg = new LlmErrorMessage({ response: {}, cause })
  assert.equal(errorMsg['http.statusCode'], 400)
  assert.equal(errorMsg['error.message'], 'Bad request')
  assert.equal(errorMsg['error.code'], undefined)
})
