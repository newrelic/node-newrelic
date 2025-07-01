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
      // body: { p: 'abcdefghijk', role: 'assistant', }
      body: new Uint8Array([123, 34, 112, 34, 58, 34, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 34, 44, 34, 114, 111, 108, 101, 34, 58, 34, 97, 115, 115, 105, 115, 116, 97, 110, 116, 34, 125])
    },
    {
      headers: {
        ':event-type': { type: 'string', value: 'contentBlockDelta', },
        ':content-type': { type: 'string', value: 'application/json', },
        ':message-type': { type: 'string', value: 'event', },
      },
      // body: { contentBlockIndex: 0, delta: { text: 'Ok', }, p: 'abcdefghijklmnop' }
      body: new Uint8Array([123, 34, 99, 111, 110, 116, 101, 110, 116, 66, 108, 111, 99, 107, 73, 110, 100, 101, 120, 34, 58, 48, 44, 34, 100, 101, 108, 116, 97, 34, 58, 123, 34, 116, 101, 120, 116, 34, 58, 34, 79, 107, 34, 125, 44, 34, 112, 34, 58, 34, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 34, 125])
    },
    {
      headers: {
        ':event-type': { type: 'string', value: 'contentBlockStop', },
        ':content-type': { type: 'string', value: 'application/json', },
        ':message-type': { type: 'string', value: 'event', },
      },
      // body: { contentBlockIndex: 0, p: 'abcdefghijklmnopqrstuvwx', }
      body: new Uint8Array([123, 34, 99, 111, 110, 116, 101, 110, 116, 66, 108, 111, 99, 107, 73, 110, 100, 101, 120, 34, 58, 48, 44, 34, 112, 34, 58, 34, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 34, 125])
    },
    {
      headers: {
        ':event-type': { type: 'string', value: 'messageStop', },
        ':content-type': { type: 'string', value: 'application/json', },
        ':message-type': { type: 'string', value: 'event', },
      },
      // body: { p: 'abcdefghijklmno', stopReason: 'end_turn', }
      body: new Uint8Array([123, 34, 112, 34, 58, 34, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 34, 44, 34, 115, 116, 111, 112, 82, 101, 97, 115, 111, 110, 34, 58, 34, 101, 110, 100, 95, 116, 117, 114, 110, 34, 125])
    },
    {
      headers: {
        ':event-type': { type: 'string', value: 'metadata', },
        ':content-type': { type: 'string', value: 'application/json', },
        ':message-type': { type: 'string', value: 'event', },
      },
      //   body: {
      //     metrics: {
      //       latencyMs: 232,
      //     },
      //     p: 'abc',
      //     usage: {
      //       inputTokens: 17,
      //       outputTokens: 6,
      //       totalTokens: 23,
      //     },
      //   }
      body: new Uint8Array([123, 34, 109, 101, 116, 114, 105, 99, 115, 34, 58, 123, 34, 108, 97, 116, 101, 110, 99, 121, 77, 115, 34, 58, 50, 51, 50, 125, 44, 34, 112, 34, 58, 34, 97, 98, 99, 34, 44, 34, 117, 115, 97, 103, 101, 34, 58, 123, 34, 105, 110, 112, 117, 116, 84, 111, 107, 101, 110, 115, 34, 58, 49, 55, 44, 34, 111, 117, 116, 112, 117, 116, 84, 111, 107, 101, 110, 115, 34, 58, 54, 44, 34, 116, 111, 116, 97, 108, 84, 111, 107, 101, 110, 115, 34, 58, 50, 51, 125, 125])
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
