/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()

responses.set('text llama2 ultimate question', {
  headers: {
    'content-type': 'application/json',
    'x-amzn-requestid': 'eda0760a-c3f0-4fc1-9a1e-75559d642866',
    'x-amzn-bedrock-invocation-latency': 9677,
    'x-amzn-bedrock-output-token-count': 4,
    'x-amzn-bedrock-input-token-count': 8
  },
  statusCode: 200,
  body: {
    generation: '42',
    prompt_token_count: 14,
    generation_token_count: 205,
    stop_reason: 'endoftext'
  }
})

responses.set('text llama2 ultimate question streamed', {
  headers: {
    'content-type': 'application/vnd.amazon.eventstream',
    'x-amzn-requestid': 'eda0760a-c3f0-4fc1-9a1e-75559d642866',
    'x-amzn-bedrock-content-type': 'application/json'
  },
  statusCode: 200,
  chunks: [
    {
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':content-type': { type: 'string', value: 'application/json' },
        ':message-type': { type: 'string', value: 'event' }
      },
      body: {
        generation: '42',
        prompt_token_count: null,
        generation_token_count: 211,
        stop_reason: null
      }
    },
    {
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':content-type': { type: 'string', value: 'application/json' },
        ':message-type': { type: 'string', value: 'event' }
      },
      body: {
        'generation': '',
        'prompt_token_count': null,
        'generation_token_count': 212,
        'stop_reason': 'endoftext',
        'amazon-bedrock-invocationMetrics': {
          inputTokenCount: 14,
          outputTokenCount: 212,
          invocationLatency: 9825,
          firstByteLatency: 283
        }
      }
    }
  ]
})

module.exports = responses
