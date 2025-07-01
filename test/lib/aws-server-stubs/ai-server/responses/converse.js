/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()
const { contentType, reqId } = require('./constants')

responses.set('text converse ultimate question', {
  headers: {
    'content-type': contentType,
    'x-amzn-requestid': reqId,
    'x-amzn-bedrock-invocation-latency': 9677,
    'x-amzn-bedrock-output-token-count': 4,
    'x-amzn-bedrock-input-token-count': 8
  },
  statusCode: 200,
  body: {
    metrics: { latencyMs: 273 },
    output: { message: { content: [{ text: 'This is a test.' }], role: 'assistant' } },
    stopReason: 'end_turn',
    usage: { inputTokens: 14, outputTokens: 9, totalTokens: 23 }
  }
})

responses.set('text converse ultimate question streamed', {
  headers: {
    'content-type': contentType,
    'x-amzn-requestid': reqId,
    'x-amzn-bedrock-invocation-latency': 9677,
    'x-amzn-bedrock-output-token-count': 4,
    'x-amzn-bedrock-input-token-count': 8
  },
  statusCode: 200,
})

responses.set('text converse ultimate question error', {
  headers: {
    'content-type': contentType,
    'x-amzn-requestid': reqId,
    'x-amzn-bedrock-invocation-latency': 9677,
    'x-amzn-bedrock-output-token-count': 4,
    'x-amzn-bedrock-input-token-count': 8
  },
})

module.exports = responses
