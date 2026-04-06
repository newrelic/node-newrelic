/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LlmErrorMessage = require('#agentlib/llm-events/error-message.js')

test('LlmErrorMessage', async () => {
  // A real error object from openai chat.completions api, version 6.33.0
  const cause = {
    status: 429,
    headers: {
    },
    requestID: 'req_0cf3b85be44044698ba4b24e20c57e0a',
    error: {
      message: 'You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.',
      type: 'insufficient_quota',
      param: 'test-param',
      code: 'insufficient_quota',
    },
    code: 'insufficient_quota',
    param: 'test-param',
    type: 'insufficient_quota',
    get message() { return `${this.status} ${this.error.message}` }
  }
  // A partial `LlmChatCompletionSummary` object. `LlmErrorMessage` just needs `completion_id` from it
  const summary = {
    ingest_source: 'Node',
    id: '5fdb53fe57a206bb5b3d38ebebc1c3a5',
    span_id: '7aa84d3a50c06743',
    trace_id: 'dd7268d054e52e409f7d9b5f0123b59e',
    vendor: 'openai',
    'llm.conversation_id': '98909711-1601-4319-b8c3-a84ba8952652',
    error: true,
    request_id: 'req_0cf3b85be44044698ba4b24e20c57e0a',
    'request.model': 'gpt-5.2',
    'request.temperature': 1,
    timestamp: 1775489641968,
    duration: 3712.029958,
  }

  // The response object doesn't really matter and may differ across openai versions;
  // all of the attributes needed for `LlmErrorMessage` are extracted from `cause`
  // and `summary`.
  const errorMsg = new LlmErrorMessage({ response: {}, cause, summary })
  const expected = {
    'http.statusCode': 429,
    'error.message': '429 You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.',
    'error.code': 'insufficient_quota',
    'error.param': 'test-param',
    completion_id: summary.id,
    embedding_id: undefined,
    vector_store_id: undefined,
    tool_id: undefined,
    agent_id: undefined
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
  assert.equal(errorMsg.agent_id, expected.agent_id)
})
