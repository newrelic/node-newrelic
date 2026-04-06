/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LangChainLlmErrorMessage = require('#agentlib/llm-events/langchain/error-message.js')

test('should use lc_error_code as error.code when present', () => {
  const errorMsg = new LangChainLlmErrorMessage({
    response: {},
    cause: {
      message: 'some langchain error',
      lc_error_code: 'MODEL_NOT_FOUND'
    },
    tool: { id: 'tool-id' }
  })
  assert.equal(errorMsg['error.message'], 'some langchain error')
  assert.equal(errorMsg['error.code'], 'MODEL_NOT_FOUND')
  assert.equal(errorMsg.tool_id, 'tool-id')
})

test('should fall through to base class error.code when lc_error_code is not present', () => {
  const errorMsg = new LangChainLlmErrorMessage({
    response: { code: 'TIMEOUT' },
    cause: {
      message: 'request timed out'
    },
    vectorsearch: { id: 'vs-id' }
  })
  assert.equal(errorMsg['error.message'], 'request timed out')
  assert.equal(errorMsg['error.code'], 'TIMEOUT')
  assert.equal(errorMsg.vector_store_id, 'vs-id')
})

test('should set completion_id from summary', () => {
  const errorMsg = new LangChainLlmErrorMessage({
    response: {},
    cause: {
      message: 'chain failed',
      lc_error_code: 'CHAIN_ERROR'
    },
    summary: { id: 'completion-123' }
  })
  assert.equal(errorMsg['error.code'], 'CHAIN_ERROR')
  assert.equal(errorMsg.completion_id, 'completion-123')
})
