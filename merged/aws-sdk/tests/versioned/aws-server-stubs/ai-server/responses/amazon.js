/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()

responses.set('embed text amazon success', {
  headers: {
    'content-type': 'application/json',
    'x-amzn-requestid': '743dd35b-744b-4ddf-b5c6-c0f3de2e3142',
    'x-amzn-bedrock-invocation-latency': '195',
    'x-amzn-bedrock-input-token-count': '13'
  },
  statusCode: 200,
  body: {
    embedding: [0.18945312, -0.36914062, -0.33984375, 0.14355469],
    inputTextTokenCount: 13
  }
})

responses.set('text amazon ultimate question', {
  headers: {
    'content-type': 'application/json',
    'x-amzn-requestid': 'eda0760a-c3f0-4fc1-9a1e-75559d642866',
    'x-amzn-bedrock-invocation-latency': '2420',
    'x-amzn-bedrock-output-token-count': '4',
    'x-amzn-bedrock-input-token-count': '8'
  },
  statusCode: 200,
  body: {
    inputTextTokenCount: 13,
    results: [
      {
        tokenCount: 4,
        outputText: '42',
        completionReason: 'endoftext'
      }
    ]
  }
})

responses.set('text amazon ultimate question streamed', {
  headers: {
    'content-type': 'application/vnd.amazon.eventstream',
    'x-amzn-requestid': '9f117b99-3b0a-486d-9d7e-3464f306df1d',
    'x-amzn-bedrock-content-type': 'application/json'
  },
  statusCode: 200,
  chunks: [
    {
      body: {
        outputText:
          '\nThe answer to life, the universe, and everything is 42. This is a reference to the popular science fiction book "The Hitchhiker\'s Guide to the Galaxy" by Douglas Ada',
        index: 0,
        totalOutputTextTokenCount: null,
        completionReason: null,
        inputTextTokenCount: 13
      },
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':message-type': { type: 'string', value: 'event' }
      }
    },
    {
      body: {
        'outputText':
          'ms. In the book, the answer to the ultimate question of life, the universe, and everything is discovered to be 42 by the supercomputer Deep Thought.',
        'index': 0,
        'totalOutputTextTokenCount': 75,
        'completionReason': 'FINISH',
        'inputTextTokenCount': null,
        'amazon-bedrock-invocationMetrics': {
          inputTokenCount: 13,
          outputTokenCount: 75,
          invocationLatency: 3879,
          firstByteLatency: 3291
        }
      },
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':message-type': { type: 'string', value: 'event' }
      }
    }
  ]
})

module.exports = responses
