/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()

responses.set('text cohere ultimate question', {
  headers: {
    'content-type': 'application/json',
    'x-amzn-requestid': 'eda0760a-c3f0-4fc1-9a1e-75559d642866',
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
    'x-amzn-requestid': '11cd0d6f-08cc-4f71-88ba-211367bd088d',
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
        'generations': [
          {
            finish_reason: 'COMPLETE',
            id: 'f4ca64e7-93ce-4722-bebe-2d383440dedf',
            text: ' In Douglas Adams\' science fiction novel *The Hitchhiker\'s Guide to the Galaxy*, the supercomputer Deep Thought is asked to find the answer to the question "What is the meaning of life, the universe, and everything?" After calculating for 7.5-million years, it returns the answer "42." \n\nWhen asked to explain the answer, Deep Thought says that it is an *"obvious*" solution, but that the answer is so un-obvious that humans are unlikely to understand it.\n\nAdams never intended the answer to be a real solution, but a humorous way to demonstrate the absurdity of expecting an answer to such a vast question. However, the number 42 has become a popular cultural reference and has been used in a variety of contexts to represent the search for meaning in life. \n\nUltimately, the answer to the question "What is the meaning of life, the universe, and everything?" is subjective and will be different for each person. Some may find meaning in relationships, family, work, hobbies, or simply in the act of living and experiencing the world. \n\nIt is also worth noting that the search for meaning can be a lifelong pursuit, and the answers to life\'s questions can change and evolve over time.'
          }
        ],
        'id': '11cd0d6f-08cc-4f71-88ba-211367bd088d',
        'prompt': 'What is the answer to life, the universe, and everything?',
        'amazon-bedrock-invocationMetrics': {
          inputTokenCount: 13,
          outputTokenCount: 257,
          invocationLatency: 8623,
          firstByteLatency: 8623
        }
      }
    }
  ]
})

responses.set('embed text cohere success', {
  headers: {
    'content-type': 'application/json',
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
    'x-amzn-requestid': 'fbd3923c-3071-4ece-8761-6ba78058f747',
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
          inputTokenCount: 2,
          outputTokenCount: 0,
          invocationLatency: 492,
          firstByteLatency: 480
        }
      }
    }
  ]
})

responses.set('text cohere ultimate question error', {
  headers: {
    'content-type': 'application/json',
    'x-amzn-requestid': 'eda0760a-c3f0-4fc1-9a1e-75559d642866',
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
    'content-type': 'application/json',
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
