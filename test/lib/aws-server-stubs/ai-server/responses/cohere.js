/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()
const { contentType, reqId } = require('./constants')

responses.set('text cohere ultimate question', {
  headers: {
    'content-type': contentType,
    'x-amzn-requestid': reqId,
    'x-amzn-bedrock-invocation-latency': '9612',
    'x-amzn-bedrock-output-token-count': '4',
    'x-amzn-bedrock-input-token-count': '8'
  },
  statusCode: 200,
  body: {
    generations: [
      {
        finish_reason: 'endoftext',
        id: '3eeb2e13-3d8e-42bb-9cb4-ae57502403c4',
        text: '42'
      }
    ],
    id: '1234',
    prompt: 'What is the answer to life, the universe, and everything?'
  }
})

responses.set('text cohere ultimate question streamed', {
  headers: {
    'content-type': 'application/vnd.amazon.eventstream',
    'x-amzn-requestid': reqId,
    'x-amzn-bedrock-content-type': contentType
  },
  statusCode: 200,
  chunks: [
    {
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':content-type': { type: 'string', value: contentType },
        ':message-type': { type: 'string', value: 'event' }
      },
      body: {
        'generations': [
          {
            finish_reason: 'endoftext',
            id: 'f4ca64e7-93ce-4722-bebe-2d383440dedf',
            text: '42'
          }
        ],
        'id': '1234',
        'prompt': 'What is the answer to life, the universe, and everything?',
        'amazon-bedrock-invocationMetrics': {
          inputTokenCount: 8,
          outputTokenCount: 4,
          invocationLatency: 8623,
          firstByteLatency: 8623
        }
      }
    }
  ]
})

responses.set('embed text cohere success', {
  headers: {
    'content-type': contentType,
    'x-amzn-requestid': '743dd35b-744b-4ddf-b5c6-c0f3de2e3142',
    'x-amzn-bedrock-invocation-latency': '195',
    'x-amzn-bedrock-input-token-count': '13'
  },
  statusCode: 200,
  body: {
    embeddings: [
      [-0.019012451, 0.031707764, -0.053985596, -0.034484863, 0.019058228, -0.008850098],
      [-2.2888184e-4, 0.02166748, -0.009109497, -0.04159546, -0.023513794, -0.007965088]
    ],
    id: '784e35b6-226c-40d2-99f3-71f66e6185da',
    texts: ['embed', 'text']
  }
})

responses.set('embed text cohere stream', {
  headers: {
    'content-type': 'application/vnd.amazon.eventstream',
    'x-amzn-requestid': reqId,
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
        'embeddings': [
          [-0.019012451, 0.031707764, -0.053985596, -0.034484863, 0.019058228, -0.008850098],
          [-2.2888184e-4, 0.02166748, -0.009109497, -0.04159546, -0.023513794, -0.007965088]
        ],
        'id': 'fbd3923c-3071-4ece-8761-6ba78058f747',
        'texts': ['foo', 'bar'],
        'amazon-bedrock-invocationMetrics': {
          inputTokenCount: 4,
          outputTokenCount: 8,
          invocationLatency: 492,
          firstByteLatency: 480
        }
      }
    }
  ]
})

responses.set('text cohere ultimate question error', {
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

responses.set('embed text cohere error', {
  headers: {
    'content-type': contentType,
    'x-amzn-requestid': '743dd35b-744b-4ddf-b5c6-c0f3de2e3142',
    'x-amzn-errortype': 'ValidationException:http://internal.amazon.com/coral/com.amazon.bedrock/'
  },
  statusCode: 400,
  body: {
    message:
      'Malformed input request: 2 schema violations found, please reformat your input and try again.'
  }
})

module.exports = responses
