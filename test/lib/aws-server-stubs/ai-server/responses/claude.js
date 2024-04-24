/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()
const { contentType, reqId } = require('./constants')

responses.set('claude insufficient context', {
  headers: {
    'content-type': contentType,
    'x-amzn-requestid': '3d4ce4d4-dd79-44e8-96d5-89d3a733ded6',
    'x-amzn-bedrock-invocation-latency': '926',
    'x-amzn-bedrock-output-token-count': '36',
    'x-amzn-bedrock-input-token-count': '14'
  },
  statusCode: 200,
  body: {
    completion:
      " I'm afraid I don't have enough context to determine the answer to your question. Could you please provide some more details about what specific question you are asking?",
    stop_reason: 'stop_sequence',
    stop: '\n\nHuman:'
  }
})

responses.set('text claude ultimate question', {
  headers: {
    'content-type': contentType,
    'x-amzn-requestid': reqId,
    'x-amzn-bedrock-invocation-latency': '609',
    'x-amzn-bedrock-output-token-count': '4',
    'x-amzn-bedrock-input-token-count': '8'
  },
  statusCode: 200,
  body: {
    // "What is the answer to life, the universe, and everything?"
    completion: '42',
    stop_reason: 'endoftext',
    stop: '\n\nHuman:'
  }
})

responses.set('text claude ultimate question streamed', {
  headers: {
    'content-type': 'application/vnd.amazon.eventstream',
    'x-amzn-requestid': reqId,
    'x-amzn-bedrock-content-type': contentType
  },
  statusCode: 200,
  chunks: [
    {
      body: { completion: '42', stop_reason: null, stop: null },
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':content-type': { type: 'string', value: 'application/json' },
        ':message-type': { type: 'string', value: 'event' }
      }
    },
    {
      body: {
        'completion': '',
        'stop_reason': 'endoftext',
        'stop': '\n\nHuman:',
        'amazon-bedrock-invocationMetrics': {
          inputTokenCount: 8,
          outputTokenCount: 4,
          invocationLatency: 511,
          firstByteLatency: 358
        }
      },
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':content-type': { type: 'string', value: 'application/json' },
        ':message-type': { type: 'string', value: 'event' }
      }
    }
  ]
})

responses.set('text claude ultimate question error', {
  headers: {
    'content-type': contentType,
    'x-amzn-requestid': reqId,
    'x-amzn-errortype': 'ValidationException:http://internal.amazon.com/coral/com.amazon.bedrock/'
  },
  statusCode: 400,
  body: {
    message:
      'Malformed input request: 2 schema violations found, please reformat your input and try again.'
  }
})

module.exports = responses
