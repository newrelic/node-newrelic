/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()
const { contentType, reqId } = require('./constants')

responses.set('text ai21 ultimate question', {
  headers: {
    'content-type': contentType,
    'x-amzn-requestid': reqId,
    'x-amzn-bedrock-invocation-latency': '180',
    'x-amzn-bedrock-output-token-count': '4',
    'x-amzn-bedrock-input-token-count': '8'
  },
  statusCode: 200,
  body: {
    id: 1234,
    prompt: {
      text: 'What is the answer to life, the universe, and everything?',
      tokens: [
        {
          generatedToken: {
            token: '▁What▁is',
            logprob: -6.8071370124816895,
            raw_logprob: -6.8071370124816895
          },
          topTokens: null,
          textRange: { start: 0, end: 7 }
        },
        {
          generatedToken: {
            token: '▁the▁answer▁to',
            logprob: -9.021844863891602,
            raw_logprob: -9.021844863891602
          },
          topTokens: null,
          textRange: { start: 7, end: 21 }
        },
        {
          generatedToken: {
            token: '▁life',
            logprob: -0.7543996572494507,
            raw_logprob: -0.7543996572494507
          },
          topTokens: null,
          textRange: { start: 21, end: 26 }
        },
        {
          generatedToken: {
            token: ',',
            logprob: -9.393946647644043,
            raw_logprob: -9.393946647644043
          },
          topTokens: null,
          textRange: { start: 26, end: 27 }
        },
        {
          generatedToken: {
            token: '▁the▁universe',
            logprob: -0.054497551172971725,
            raw_logprob: -0.054497551172971725
          },
          topTokens: null,
          textRange: { start: 27, end: 40 }
        },
        {
          generatedToken: {
            token: ',',
            logprob: -1.3849022388458252,
            raw_logprob: -1.3849022388458252
          },
          topTokens: null,
          textRange: { start: 40, end: 41 }
        },
        {
          generatedToken: {
            token: '▁and▁everything',
            logprob: -0.03310895338654518,
            raw_logprob: -0.03310895338654518
          },
          topTokens: null,
          textRange: { start: 41, end: 56 }
        },
        {
          generatedToken: {
            token: '?',
            logprob: -6.455468654632568,
            raw_logprob: -6.455468654632568
          },
          topTokens: null,
          textRange: { start: 56, end: 57 }
        }
      ]
    },
    completions: [
      {
        data: {
          text: '42',
          tokens: [
            {
              generatedToken: {
                token: '<|newline|>',
                logprob: -5.245195097813848e-6,
                raw_logprob: -5.245195097813848e-6
              },
              topTokens: null,
              textRange: { start: 0, end: 1 }
            },
            {
              generatedToken: {
                token: '▁',
                logprob: -2.2998135089874268,
                raw_logprob: -2.2998135089874268
              },
              topTokens: null,
              textRange: { start: 1, end: 1 }
            },
            {
              generatedToken: {
                token: '42',
                logprob: -3.844952443614602e-4,
                raw_logprob: -3.844952443614602e-4
              },
              topTokens: null,
              textRange: { start: 1, end: 3 }
            },
            {
              generatedToken: {
                token: '<|endoftext|>',
                logprob: -4.766043566633016e-4,
                raw_logprob: -4.766043566633016e-4
              },
              topTokens: null,
              textRange: { start: 3, end: 3 }
            }
          ]
        },
        finishReason: { reason: 'endoftext' }
      }
    ]
  }
})

responses.set('text ai21 ultimate question error streamed', {
  headers: {
    'content-type': contentType,
    'x-amzn-requestid': reqId,
    'x-amzn-errortype': 'ValidationException:http://internal.amazon.com/coral/com.amazon.bedrock/'
  },
  statusCode: 400,
  body: { message: 'The model is unsupported for streaming' }
})

responses.set('text ai21 ultimate question error', {
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
