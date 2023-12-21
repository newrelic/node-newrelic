/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()

responses.set('ultimate question', {
  headers: {
    'content-type': 'application/json',
    'x-amzn-requestid': '0bbc5237-c485-4049-8b87-794cc84c383a',
    'x-amzn-bedrock-invocation-latency': '9612',
    'x-amzn-bedrock-output-token-count': '320',
    'x-amzn-bedrock-input-token-count': '13'
  },
  statusCode: 200,
  body: {
    generations: [
      {
        finish_reason: 'COMPLETE',
        id: '3eeb2e13-3d8e-42bb-9cb4-ae57502403c4',
        text: ' In Douglas Adams\' science fiction novel *The Hitchhiker\'s Guide to the Galaxy*, the answer to the ultimate question of life, the universe, and everything is "42". This answer is a popular cultural reference, and it has been interpreted in many different ways.\n\nIn the novel, a supercomputer named Deep Thought is asked to find the answer to the ultimate question of life, the universe, and everything, and after millions of years of computation, it returns the answer "42". The characters are surprised and confused by this response, as they had expected a meaningful answer.\n\nThe meaning of "42" is not explicitly explained in the novel, but the author has stated that it is a random number that was chosen to be a joke. It is a play on the idea that the answer to life\'s questions should be meaningful and profound, and the fact that the answer is a random number is a way of poking fun at the idea of seeking a definitive answer to such a profound question.\n\nThe meaning of "42" can be interpreted in many ways, and it is often used as a way to explore the absurdity of life and the universe. It is a reminder that the universe is vast and complex, and that we should not expect simple answers to the questions that we ask.\n\nIn the end, the answer to life, the universe, and everything may be an absurdist joke, but it can also be a reminder to appreciate the beauty and mystery of life and the universe, and to approach our questions with a sense of humor and wonder.'
      }
    ],
    id: '0bbc5237-c485-4049-8b87-794cc84c383a',
    prompt: 'What is the answer to life, the universe, and everything?'
  }
})

responses.set('ultimate question stream', {
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

responses.set('embed text', {
  headers: {
    'content-type': 'application/json',
    'x-amzn-requestid': '784e35b6-226c-40d2-99f3-71f66e6185da',
    'x-amzn-bedrock-invocation-latency': '149',
    'x-amzn-bedrock-input-token-count': '2'
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

responses.set('embed text stream', {
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

module.exports = responses
