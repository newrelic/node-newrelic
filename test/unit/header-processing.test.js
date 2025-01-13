/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const headerProcessing = require('../../lib/header-processing')

test('#getContentLengthFromHeaders', async (t) => {
  await t.test('should return content-length headers, case insensitive', () => {
    // does it work?
    assert.equal(headerProcessing.getContentLengthFromHeaders({ 'Content-Length': 100 }), 100)

    // does it work with weird casing?
    assert.equal(headerProcessing.getContentLengthFromHeaders({ 'ConTent-LenGth': 100 }), 100)

    // does it ignore other headers?
    assert.equal(
      headerProcessing.getContentLengthFromHeaders({
        zip: 'zap',
        'Content-Length': 100,
        foo: 'bar'
      }),
      100
    )

    // when presented with two headers that are the same name
    // but different case, does t.test prefer the first one found.
    // This captures the exact behavior of the legacy code we're
    // replacing
    assert.equal(
      headerProcessing.getContentLengthFromHeaders({
        zip: 'zap',
        'content-length': 50,
        'Content-Length': 100,
        foo: 'bar'
      }),
      50
    )

    // doesn't fail when working with null prototype objects
    // (returned by res.getHeaders() is -- some? all? versions
    // of NodeJS
    const fixture = Object.create(null)
    fixture.zip = 'zap'
    fixture['content-length'] = 49
    fixture['Content-Length'] = 100
    fixture.foo = 'bar'
    assert.equal(headerProcessing.getContentLengthFromHeaders(fixture), 49)
  })

  await t.test('should return -1 if there is no header', () => {
    assert.equal(headerProcessing.getContentLengthFromHeaders({}), -1)

    assert.equal(headerProcessing.getContentLengthFromHeaders('foo'), -1)

    assert.equal(headerProcessing.getContentLengthFromHeaders([]), -1)

    assert.equal(headerProcessing.getContentLengthFromHeaders({ foo: 'bar', zip: 'zap' }), -1)
  })
})

test('#getQueueTime', async (t) => {
  // This header can hold up to 4096 bytes which could quickly fill up logs.
  // Do not log a level higher than debug.
  await t.test('should not log invalid raw queue time higher than debug level', () => {
    const invalidRawQueueTime = 'z1232442z'
    const requestHeaders = {
      'x-queue-start': invalidRawQueueTime
    }

    let didLogHighLevel = false
    let didLogLowLevel = false

    const mockLogger = {
      trace: checkLogRawQueueTimeLowLevel,
      debug: checkLogRawQueueTimeLowLevel,
      info: checkLogRawQueueTimeHighLevel,
      warn: checkLogRawQueueTimeHighLevel,
      error: checkLogRawQueueTimeHighLevel
    }

    const queueTime = headerProcessing.getQueueTime(mockLogger, requestHeaders)

    assert.equal(queueTime, undefined)
    assert.equal(didLogHighLevel, false)
    assert.equal(didLogLowLevel, true)

    function didLogRawQueueTime(args) {
      let didLog = false

      args.forEach((argument) => {
        const foundQueueTime = argument.indexOf(invalidRawQueueTime) >= 0
        if (foundQueueTime) {
          didLog = true
        }
      })

      return didLog
    }

    function checkLogRawQueueTimeHighLevel(...args) {
      if (didLogRawQueueTime(args)) {
        didLogHighLevel = true
      }
    }

    function checkLogRawQueueTimeLowLevel(...args) {
      if (didLogRawQueueTime(args)) {
        didLogLowLevel = true
      }
    }
  })
})
