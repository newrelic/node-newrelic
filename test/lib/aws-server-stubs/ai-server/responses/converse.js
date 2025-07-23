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
    stopReason: 'endoftext',
    usage: { inputTokens: 14, outputTokens: 9, totalTokens: 23 }
  }
})

responses.set('text converse ultimate question streamed', {
  headers: {
    'content-type': 'application/vnd.amazon.eventstream',
    'x-amzn-requestid': reqId,
    'x-amzn-bedrock-content-type': contentType
  },
  statusCode: 200,
  chunks: [
    {
      headers: {
        ':event-type': { type: 'string', value: 'messageStart', },
        ':content-type': { type: 'string', value: 'application/json', },
        ':message-type': { type: 'string', value: 'event', },
      },
      body: { p: 'abcdefghijk', role: 'assistant', }
    },
    {
      headers: {
        ':event-type': { type: 'string', value: 'contentBlockDelta', },
        ':content-type': { type: 'string', value: 'application/json', },
        ':message-type': { type: 'string', value: 'event', },
      },
      body: { contentBlockIndex: 0, delta: { text: 'This is a test.', }, p: 'abcdefghijklmnop' }
    },
    {
      headers: {
        ':event-type': { type: 'string', value: 'contentBlockStop', },
        ':content-type': { type: 'string', value: 'application/json', },
        ':message-type': { type: 'string', value: 'event', },
      },
      body: { contentBlockIndex: 0, p: 'abcdefghijklmnopqrstuvwx', }
    },
    {
      headers: {
        ':event-type': { type: 'string', value: 'messageStop', },
        ':content-type': { type: 'string', value: 'application/json', },
        ':message-type': { type: 'string', value: 'event', },
      },
      body: { p: 'abcdefghijklmno', stopReason: 'endoftext', }
    },
    {
      headers: {
        ':event-type': { type: 'string', value: 'metadata', },
        ':content-type': { type: 'string', value: 'application/json', },
        ':message-type': { type: 'string', value: 'event', },
      },
      body: {
        metrics: { latencyMs: 232, },
        p: 'abc',
        usage: { inputTokens: 17, outputTokens: 6, totalTokens: 23, },
      }
    }
  ]
})

responses.set('text converse ultimate question error', {
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
